import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatToJid,
  type ConnectionStatusResult,
  type IMessagingProvider,
  type OutboundMessageContent,
  type SendResult,
} from '@mejoraws/shared';
import { env } from '../config/env.js';
import { InMemorySentCacheAndLimiter } from '../infrastructure/cache/SentCacheAndLimiter.js';
import { InMemoryWorkerStore } from '../infrastructure/persistence/WorkerDataStore.js';
import {
  MultiProviderLLMAdapter,
  OwnerWebhookNotifier,
} from '../infrastructure/ai/MultiProviderLLMAdapter.js';
import { AIRetentionEngine } from '../application/AIRetentionEngine.js';
import { OutboundMessageProcessor } from '../application/OutboundMessageProcessor.js';

const TEST_PHONE_1 = '3764358152';
const TEST_PHONE_2 = '3765007805';
const TEST_JID_1 = formatToJid(TEST_PHONE_1); // 5493764358152@s.whatsapp.net
const TEST_JID_2 = formatToJid(TEST_PHONE_2); // 5493765007805@s.whatsapp.net

describe('Orchestrator Worker — BullMQ Consumer, Simulación Humana y Motor IA (PRD v1.0 Paso 3)', () => {
  let dataStore: InMemoryWorkerStore;
  let sentCache: InMemorySentCacheAndLimiter;
  let callOrder: string[];
  let recordedSleepMs: number[];
  let messagingProvider: IMessagingProvider;

  beforeEach(() => {
    dataStore = new InMemoryWorkerStore();
    sentCache = new InMemorySentCacheAndLimiter();
    callOrder = [];
    recordedSleepMs = [];

    messagingProvider = {
      presenceSubscribe: vi.fn(async (jid: string) => {
        callOrder.push(`presenceSubscribe:${jid}`);
      }),
      sendPresenceUpdate: vi.fn(
        async (
          jid: string,
          type: 'composing' | 'paused' | 'available' | 'unavailable'
        ) => {
          callOrder.push(`presence:${type}:${jid}`);
        }
      ),
      sendMessage: vi.fn(
        async (
          jid: string,
          content: OutboundMessageContent
        ): Promise<SendResult> => {
          callOrder.push(`sendMessage:${jid}:${content.contentType}`);
          return {
            messageId: `wa_msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            status: 'SENT',
            timestamp: new Date(),
          };
        }
      ),
      syncContacts: vi.fn(async () => []),
      getConnectionStatus: vi.fn(
        async (): Promise<ConnectionStatusResult> => ({
          state: 'connected',
          instanceName: env.INSTANCE_NAME,
        })
      ),
    };
  });

  it('1. Simulación Humana "composing" (1.5s-4s) + Spintax/Plantilla + Registro en sent_cache para 3764358152', async () => {
    const contact = await dataStore.upsertContact({
      jid: TEST_JID_1,
      phone_number: '5493764358152',
      address_book_name: 'Carlos Misiones',
      is_whitelisted: true,
    });

    const safeNow = new Date(2026, 10, 20, 10, 30, 0, 0);
    const job = await dataStore.createScheduledJob({
      instance_id: env.INSTANCE_NAME,
      idempotency_key: 'worker-job-001',
      contact_id: contact.id,
      payload: {
        body: '{Hola|Buen día} {nombre}, te compartimos el enlace https://mejoracontinua.ar',
        content_type: 'URL',
        urgent: false,
      },
      scheduled_for: safeNow,
      effective_send_at: safeNow,
      status: 'PENDING',
    });

    await dataStore.createMessage({
      instance_id: env.INSTANCE_NAME,
      whatsapp_message_id: `pending_${job.id}`,
      contact_id: contact.id,
      direction: 'OUTBOUND',
      sender_type: 'SYSTEM_API',
      content_type: 'URL',
      body: job.payload.body,
      media_url: null,
      media_filename: null,
      is_broadcast: false,
      status: 'QUEUED',
    });

    const processor = new OutboundMessageProcessor({
      dataStore,
      sentCache,
      messagingProvider,
      enforceWhitelist: true,
      sleepFn: async (ms) => {
        callOrder.push(`sleep:${ms}`);
        recordedSleepMs.push(ms);
      },
    });

    const result = await processor.processJob(job.id, safeNow);

    expect(result.outcome).toBe('SENT');
    expect(result.whatsappMessageId).toBeDefined();
    expect(result.typingDurationMs).toBeGreaterThanOrEqual(1500);
    expect(result.typingDurationMs).toBeLessThanOrEqual(4000);
    expect(recordedSleepMs[0]).toBe(result.typingDurationMs);

    // Verificar resolución de plantilla y Spintax
    expect(result.renderedText).toMatch(/^(Hola|Buen día) Carlos Misiones/);
    expect(result.renderedText).not.toContain('{nombre}');

    // Verificar secuencia exacta: presenceSubscribe -> composing -> sleep -> paused -> sendMessage
    expect(callOrder).toEqual([
      `presenceSubscribe:${TEST_JID_1}`,
      `presence:composing:${TEST_JID_1}`,
      `sleep:${result.typingDurationMs}`,
      `presence:paused:${TEST_JID_1}`,
      `sendMessage:${TEST_JID_1}:URL`,
    ]);

    // Verificar que el messageId quedó registrado en sent_cache (Salvaguarda Celular Físico)
    expect(
      await sentCache.wasMessageSentBySystem(result.whatsappMessageId!)
    ).toBe(true);

    // Verificar estado COMPLETED del job y actualización del mensaje en DB
    const updatedJob = await dataStore.getScheduledJobById(job.id);
    expect(updatedJob?.status).toBe('COMPLETED');

    const messages = await dataStore.listMessagesByContact(contact.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].whatsapp_message_id).toBe(result.whatsappMessageId);
    expect(messages[0].status).toBe('SENT');
  });

  it('2. Cortafuegos Whitelist e Idempotencia en el Worker: bloquea 3765007805 sin whitelist e impide doble envío por idempotency_key', async () => {
    const unwhitelistedContact = await dataStore.upsertContact({
      jid: TEST_JID_2,
      phone_number: '5493765007805',
      address_book_name: 'Contacto No Autorizado',
      is_whitelisted: false,
    });

    const safeNow = new Date(2026, 10, 20, 11, 0, 0, 0);
    const blockedJob = await dataStore.createScheduledJob({
      instance_id: env.INSTANCE_NAME,
      idempotency_key: null,
      contact_id: unwhitelistedContact.id,
      payload: { body: 'Intento sin whitelist', content_type: 'TEXT' },
      scheduled_for: safeNow,
      effective_send_at: safeNow,
      status: 'PENDING',
    });

    const processor = new OutboundMessageProcessor({
      dataStore,
      sentCache,
      messagingProvider,
      enforceWhitelist: true,
      sleepFn: async () => {},
    });

    const blockedRes = await processor.processJob(blockedJob.id, safeNow);
    expect(blockedRes.outcome).toBe('BLOCKED_WHITELIST');
    expect(messagingProvider.sendMessage).not.toHaveBeenCalled();

    const failedJob = await dataStore.getScheduledJobById(blockedJob.id);
    expect(failedJob?.status).toBe('FAILED');

    // Autorizar 3765007805 y probar idempotencia con dos jobs que comparten llave
    await dataStore.upsertContact({
      jid: TEST_JID_2,
      phone_number: '5493765007805',
      is_whitelisted: true,
    });

    const jobA = await dataStore.createScheduledJob({
      instance_id: env.INSTANCE_NAME,
      idempotency_key: 'idem-key-shared-999',
      contact_id: unwhitelistedContact.id,
      payload: { body: 'Envío único garantizado', content_type: 'TEXT' },
      scheduled_for: safeNow,
      effective_send_at: safeNow,
      status: 'PENDING',
    });

    const jobB = await dataStore.createScheduledJob({
      instance_id: env.INSTANCE_NAME,
      idempotency_key: 'idem-key-shared-999',
      contact_id: unwhitelistedContact.id,
      payload: { body: 'Envío único garantizado', content_type: 'TEXT' },
      scheduled_for: safeNow,
      effective_send_at: safeNow,
      status: 'PENDING',
    });

    const resA = await processor.processJob(jobA.id, safeNow);
    const resB = await processor.processJob(jobB.id, safeNow);

    expect(resA.outcome).toBe('SENT');
    expect(resB.outcome).toBe('SKIPPED_DUPLICATE_IDEMPOTENCY');
    expect(messagingProvider.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('3. Protección SAFE_HOURS y Pausa Global: pospone envíos nocturnos (22:30 -> 08:30), libera urgentes y respeta pausa global', async () => {
    const contact = await dataStore.upsertContact({
      jid: TEST_JID_1,
      phone_number: '5493764358152',
      address_book_name: 'Contacto Horario Seguro',
      is_whitelisted: true,
    });

    const lateNight = new Date(2026, 10, 20, 22, 30, 0, 0);
    const normalNightJob = await dataStore.createScheduledJob({
      instance_id: env.INSTANCE_NAME,
      idempotency_key: null,
      contact_id: contact.id,
      payload: {
        body: 'Mensaje comercial no urgente',
        content_type: 'TEXT',
        urgent: false,
      },
      scheduled_for: lateNight,
      effective_send_at: lateNight,
      status: 'PENDING',
    });

    const processor = new OutboundMessageProcessor({
      dataStore,
      sentCache,
      messagingProvider,
      enforceWhitelist: true,
      safeHoursStart: '08:30',
      safeHoursEnd: '20:30',
      sleepFn: async () => {},
    });

    // 1) A las 22:30 sin urgent -> se reprograma a las 08:30 del día siguiente
    const nightResult = await processor.processJob(
      normalNightJob.id,
      lateNight
    );
    expect(nightResult.outcome).toBe('RESCHEDULED_SAFE_HOURS');
    expect(nightResult.rescheduledFor?.getDate()).toBe(21);
    expect(nightResult.rescheduledFor?.getHours()).toBe(8);
    expect(nightResult.rescheduledFor?.getMinutes()).toBe(30);
    expect(messagingProvider.sendMessage).not.toHaveBeenCalled();

    // 2) Con cola pausada -> SKIPPED_QUEUE_PAUSED
    await sentCache.setQueuePaused(true);
    const pausedAttempt = await processor.processJob(
      normalNightJob.id,
      new Date(2026, 10, 21, 9, 0, 0, 0)
    );
    expect(pausedAttempt.outcome).toBe('SKIPPED_QUEUE_PAUSED');
    await sentCache.setQueuePaused(false);

    // 3) Con urgent: true a las 22:30 -> se envía de inmediato
    const urgentNightJob = await dataStore.createScheduledJob({
      instance_id: env.INSTANCE_NAME,
      idempotency_key: null,
      contact_id: contact.id,
      payload: {
        body: 'Alerta urgente 22:30',
        content_type: 'TEXT',
        urgent: true,
      },
      scheduled_for: lateNight,
      effective_send_at: lateNight,
      status: 'PENDING',
    });

    const urgentResult = await processor.processJob(
      urgentNightJob.id,
      lateNight
    );
    expect(urgentResult.outcome).toBe('SENT');
    expect(messagingProvider.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('4. Motor IA en Modo AI_RETENTION: responde con tono humano natural, elimina jerga robótica y mantiene AI_RETENTION en consulta general', async () => {
    const contact = await dataStore.upsertContact({
      jid: TEST_JID_1,
      phone_number: '5493764358152',
      address_book_name: 'Laura Posadas',
      is_whitelisted: true,
      ai_mode: 'AI_RETENTION',
    });

    const enqueuedJobs: string[] = [];
    const notifier = new OwnerWebhookNotifier('');

    // Simulamos un LLM que intenta infiltrar muletillas robóticas prohibidas por PRD § 3
    const roboticLlmMock = {
      generateRetentionReply: vi.fn(
        async () =>
          'Como modelo de lenguaje, soy un asistente virtual. Te transfiero con un asesor. ¡Hola Laura! Atendemos de lunes a viernes de 8:30 a 20:30 hs.'
      ),
      summarizeConversationTwoLines: vi.fn(
        async () => 'Línea 1 resumen\nLínea 2 resumen'
      ),
    };

    const engine = new AIRetentionEngine({
      dataStore,
      llmProvider: roboticLlmMock,
      alertNotifier: notifier,
      enqueueOutboundJob: async (job) => {
        enqueuedJobs.push(job.id);
      },
    });

    const decision = await engine.processInboundMessage({
      contactId: contact.id,
      inboundMessageText: 'Hola, ¿en qué días y horarios atienden?',
    });

    expect(decision.shouldReply).toBe(true);
    expect(decision.escalated).toBe(false);
    expect(decision.nextMode).toBe('AI_RETENTION');
    expect(decision.replyText).not.toMatch(/modelo de lenguaje/i);
    expect(decision.replyText).not.toMatch(/asistente virtual/i);
    expect(decision.replyText).not.toMatch(/transfiero con un asesor/i);
    expect(decision.replyText).toContain(
      '¡Hola Laura! Atendemos de lunes a viernes de 8:30 a 20:30 hs.'
    );
    expect(enqueuedJobs).toHaveLength(1);
    expect(notifier.dispatchedAlerts).toHaveLength(0);
  });

  it('5. Escalado por Intención de Compra (handoff_keywords) en 3764358152: dispara alerta al dueño con resumen de 2 líneas + link y pasa a HUMAN_TAKEOVER', async () => {
    const contact = await dataStore.upsertContact({
      jid: TEST_JID_1,
      phone_number: '5493764358152',
      address_book_name: 'Martín Oberá',
      is_whitelisted: true,
      ai_mode: 'AI_RETENTION',
    });

    const webhookCalls: Array<{ url: string; body: Record<string, unknown> }> =
      [];
    const notifier = new OwnerWebhookNotifier(
      'https://hooks.mejoracontinua.ar/owner-alert',
      (async (input: RequestInfo | URL, init?: RequestInit) => {
        webhookCalls.push({
          url: String(input),
          body: JSON.parse(String(init?.body || '{}')),
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }) as typeof fetch
    );

    const llmAdapter = new MultiProviderLLMAdapter({ apiKey: '' });
    const engine = new AIRetentionEngine({
      dataStore,
      llmProvider: llmAdapter,
      alertNotifier: notifier,
      dashboardBaseUrl: 'http://localhost:5176',
    });

    const now = new Date(2026, 10, 20, 14, 0, 0, 0);
    const decision = await engine.processInboundMessage({
      contactId: contact.id,
      inboundMessageText:
        'Hola, me interesa saber el precio del servicio y coordinar una reunión',
      now,
    });

    expect(decision.shouldReply).toBe(true);
    expect(decision.escalated).toBe(true);
    expect(decision.escalationReason).toBe('KEYWORD_MATCH');
    expect(decision.nextMode).toBe('HUMAN_TAKEOVER');
    expect(decision.mutedUntil?.getTime()).toBe(
      now.getTime() + 24 * 3600 * 1000
    );

    // Verificar alerta enviada al dueño con nombre, resumen de 2 líneas y enlace directo al chat
    expect(notifier.dispatchedAlerts).toHaveLength(1);
    expect(webhookCalls).toHaveLength(1);
    expect(webhookCalls[0].url).toBe(
      'https://hooks.mejoracontinua.ar/owner-alert'
    );
    expect(decision.alertPayload?.contactName).toBe('Martín Oberá');
    expect(decision.alertPayload?.chatUrl).toBe(
      `http://localhost:5176/conversations/${contact.id}`
    );
    expect(
      decision.alertPayload?.summaryTwoLines.split('\n').filter(Boolean)
    ).toHaveLength(2);

    // Verificar que el contacto quedó en HUMAN_TAKEOVER en la base de datos
    const updatedContact = await dataStore.getContactById(contact.id);
    expect(updatedContact?.ai_mode).toBe('HUMAN_TAKEOVER');
  });

  it('6. Escalado por Límite de Turnos (max_auto_turns=2) en 3765007805 y soporte multi-proveedor (OpenAI / Gemini / Anthropic)', async () => {
    dataStore.setAIConfig({ max_auto_turns: 2 });

    const contact = await dataStore.upsertContact({
      jid: TEST_JID_2,
      phone_number: '5493765007805',
      address_book_name: 'Lucía Eldorado',
      is_whitelisted: true,
      ai_mode: 'AI_RETENTION',
    });

    const notifier = new OwnerWebhookNotifier('');
    const llmAdapter = new MultiProviderLLMAdapter({ apiKey: '' });
    const engine = new AIRetentionEngine({
      dataStore,
      llmProvider: llmAdapter,
      alertNotifier: notifier,
    });

    // Turno 1 (consulta sin keyword de cierre): permanece en AI_RETENTION
    const turn1 = await engine.processInboundMessage({
      contactId: contact.id,
      inboundMessageText: 'Hola, tengo una consulta sobre cómo trabajan',
    });
    expect(turn1.shouldReply).toBe(true);
    expect(turn1.escalated).toBe(false);
    expect(turn1.nextMode).toBe('AI_RETENTION');

    // Turno 2 (alcanza max_auto_turns = 2): responde, alerta al dueño y pasa a HUMAN_TAKEOVER
    const turn2 = await engine.processInboundMessage({
      contactId: contact.id,
      inboundMessageText: '¿Trabajan también en el interior de Misiones?',
    });
    expect(turn2.shouldReply).toBe(true);
    expect(turn2.escalated).toBe(true);
    expect(turn2.escalationReason).toBe('MAX_TURNS_REACHED');
    expect(turn2.nextMode).toBe('HUMAN_TAKEOVER');
    expect(notifier.dispatchedAlerts).toHaveLength(1);
    expect(notifier.dispatchedAlerts[0].reason).toBe('MAX_TURNS_REACHED');
  });

  it('7. Silencio en HUMAN_TAKEOVER, Reactivación al Expirar Mute y Baja Automática (OPT_OUT_REQUEST -> MUTED)', async () => {
    const now = new Date(2026, 10, 20, 15, 0, 0, 0);
    const futureMute = new Date(now.getTime() + 12 * 3600 * 1000);

    const contact1 = await dataStore.upsertContact({
      jid: TEST_JID_1,
      phone_number: '5493764358152',
      address_book_name: 'Contacto En Handoff',
      is_whitelisted: true,
      ai_mode: 'HUMAN_TAKEOVER',
      ai_muted_until: futureMute,
    });

    const notifier = new OwnerWebhookNotifier('');
    const engine = new AIRetentionEngine({
      dataStore,
      llmProvider: new MultiProviderLLMAdapter({ apiKey: '' }),
      alertNotifier: notifier,
    });

    // Mientras HUMAN_TAKEOVER está vigente -> no responde
    const silentRes = await engine.processInboundMessage({
      contactId: contact1.id,
      inboundMessageText: 'Sigo hablando con el dueño',
      now,
    });
    expect(silentRes.shouldReply).toBe(false);
    expect(silentRes.nextMode).toBe('HUMAN_TAKEOVER');

    // Una vez vencido ai_muted_until (+13h) -> reactiva AI_RETENTION automáticamente
    const afterExpiry = new Date(now.getTime() + 13 * 3600 * 1000);
    const reactivatedRes = await engine.processInboundMessage({
      contactId: contact1.id,
      inboundMessageText: 'Hola de nuevo, ¿están disponibles?',
      now: afterExpiry,
    });
    expect(reactivatedRes.shouldReply).toBe(true);

    // Solicitud de baja en 3765007805 -> pasa a MUTED y no envía mensaje automático
    const contact2 = await dataStore.upsertContact({
      jid: TEST_JID_2,
      phone_number: '5493765007805',
      address_book_name: 'Contacto Solicita Baja',
      is_whitelisted: true,
      ai_mode: 'AI_RETENTION',
    });

    const optOutRes = await engine.processInboundMessage({
      contactId: contact2.id,
      inboundMessageText: 'No me interesa, por favor darme de baja',
      now,
    });
    expect(optOutRes.shouldReply).toBe(false);
    expect(optOutRes.escalated).toBe(true);
    expect(optOutRes.escalationReason).toBe('OPT_OUT_REQUEST');
    expect(optOutRes.nextMode).toBe('MUTED');

    const updatedContact2 = await dataStore.getContactById(contact2.id);
    expect(updatedContact2?.ai_mode).toBe('MUTED');
  });
});
