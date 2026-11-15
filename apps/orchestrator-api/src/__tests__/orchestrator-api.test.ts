import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  formatToJid,
  type ConnectionStatusResult,
  type Contact,
  type IMessagingProvider,
  type OutboundMessageContent,
  type SendResult,
} from '@mejoraws/shared';
import { buildApp } from '../app.js';
import { env } from '../config/env.js';
import { InMemoryDataStore } from '../infrastructure/persistence/InMemoryDataStore.js';
import { InMemoryQueueDispatcher } from '../infrastructure/queue/BullMQDispatcher.js';

const TEST_PHONE_1 = '3764358152';
const TEST_PHONE_2 = '3765007805';
const TEST_JID_1 = formatToJid(TEST_PHONE_1); // 5493764358152@s.whatsapp.net
const TEST_JID_2 = formatToJid(TEST_PHONE_2); // 5493765007805@s.whatsapp.net

function createMockMessagingProvider(
  contactsToSync: Partial<Contact>[] = []
): IMessagingProvider {
  return {
    sendMessage: vi.fn(
      async (_jid: string, _content: OutboundMessageContent): Promise<SendResult> => ({
        messageId: `evo_mock_${Date.now()}`,
        status: 'SENT',
        timestamp: new Date(),
      })
    ),
    sendPresenceUpdate: vi.fn(async () => undefined),
    presenceSubscribe: vi.fn(async () => undefined),
    syncContacts: vi.fn(async () => contactsToSync),
    getConnectionStatus: vi.fn(
      async (): Promise<ConnectionStatusResult> => ({
        state: 'connected',
        instanceName: env.INSTANCE_NAME,
        phone: '5493764000000',
      })
    ),
  };
}

describe('Orchestrator API v1 — Pruebas de Integración (PRD v1.0 Paso 2)', () => {
  let app: FastifyInstance;
  let dataStore: InMemoryDataStore;
  let queueDispatcher: InMemoryQueueDispatcher;
  let messagingProvider: IMessagingProvider;

  beforeEach(async () => {
    dataStore = new InMemoryDataStore();
    queueDispatcher = new InMemoryQueueDispatcher();
    messagingProvider = createMockMessagingProvider([
      {
        instance_id: env.INSTANCE_NAME,
        jid: TEST_JID_1,
        phone_number: '5493764358152',
        push_name: 'Contacto Prueba 1',
        address_book_name: 'Prueba Misiones 1',
        is_in_broadcast: true,
        broadcast_lists: ['lista_clientes_vip@broadcast'],
        metadata: { source: 'mock_sync' },
      },
      {
        instance_id: env.INSTANCE_NAME,
        jid: TEST_JID_2,
        phone_number: '5493765007805',
        push_name: 'Contacto Prueba 2',
        address_book_name: 'Prueba Misiones 2',
        is_in_broadcast: true,
        broadcast_lists: ['lista_clientes_vip@broadcast'],
        metadata: { source: 'mock_sync' },
      },
    ]);

    app = await buildApp({
      dataStore,
      queueDispatcher,
      messagingProvider,
      enforceWhitelist: true,
      logger: false,
    });
  });

  // Prueba 1: Seguridad HTTP (401 sin x-api-key ni cookie JWT)
  it('1. Seguridad: rechaza con 401 POST /api/v1/messages/send sin x-api-key ni JWT y acepta x-api-key válida', async () => {
    const unauthRes = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/send',
      payload: {
        phone: TEST_PHONE_1,
        text: 'Intento sin credenciales',
      },
    });
    expect(unauthRes.statusCode).toBe(401);

    const badKeyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/send',
      headers: { 'x-api-key': 'sk_invalid_key' },
      payload: {
        phone: TEST_PHONE_1,
        text: 'Llave inválida',
      },
    });
    expect(badKeyRes.statusCode).toBe(401);

    const healthWithKey = await app.inject({
      method: 'GET',
      url: '/api/v1/system/health',
      headers: { 'x-api-key': env.MASTER_API_KEY },
    });
    expect(healthWithKey.statusCode).toBe(200);
    const body = healthWithKey.json<{ ok: boolean; enforceWhitelist: boolean }>();
    expect(body.ok).toBe(true);
    expect(body.enforceWhitelist).toBe(true);
  });

  // Prueba 2: Login Admin (Cookie HttpOnly + JWT)
  it('2. Login: autentica al usuario maestro, emite cookie HttpOnly mejoraws_token y habilita /system/health', async () => {
    const badLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: env.ADMIN_USER,
        password: 'wrong_password',
      },
    });
    expect(badLogin.statusCode).toBe(401);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        username: env.ADMIN_USER,
        password: env.ADMIN_PASSWORD,
      },
    });
    expect(loginRes.statusCode).toBe(200);

    const loginBody = loginRes.json<{ ok: boolean; user: string; token: string }>();
    expect(loginBody.ok).toBe(true);
    expect(loginBody.user).toBe(env.ADMIN_USER);
    expect(typeof loginBody.token).toBe('string');

    const rawSetCookie = loginRes.headers['set-cookie'];
    const cookieList = Array.isArray(rawSetCookie)
      ? rawSetCookie
      : rawSetCookie
      ? [rawSetCookie]
      : [];
    const authCookieHeader = cookieList.find((c) => c.startsWith('mejoraws_token='));
    expect(authCookieHeader).toBeDefined();
    expect(authCookieHeader).toMatch(/HttpOnly/i);

    const cookiePair = authCookieHeader!.split(';')[0];
    const healthRes = await app.inject({
      method: 'GET',
      url: '/api/v1/system/health',
      headers: { cookie: cookiePair },
    });
    expect(healthRes.statusCode).toBe(200);
    const healthBody = healthRes.json<{
      ok: boolean;
      instanceName: string;
      whatsapp: { state: string };
      enforceWhitelist: boolean;
    }>();
    expect(healthBody.ok).toBe(true);
    expect(healthBody.instanceName).toBe(env.INSTANCE_NAME);
    expect(healthBody.whatsapp.state).toBe('connected');
    expect(healthBody.enforceWhitelist).toBe(true);
  });

  // Prueba 3: Cortafuegos Whitelist con números reales 3764358152 y 3765007805
  it('3. Whitelist Firewall: bloquea con 403 destinatarios no autorizados y habilita 202 al aprobar 3764358152 y 3765007805', async () => {
    const authHeaders = { 'x-api-key': env.MASTER_API_KEY };

    // Número inexistente/no autorizado debe ser bloqueado por ENFORCE_WHITELIST=true
    const blockedUnknown = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/send',
      headers: authHeaders,
      payload: {
        phone: TEST_PHONE_1,
        text: 'Mensaje bloqueado antes de existir en whitelist',
      },
    });
    expect(blockedUnknown.statusCode).toBe(403);

    // Crear contacto 3764358152 con is_whitelisted=false
    const createRes1 = await app.inject({
      method: 'POST',
      url: '/api/v1/contacts',
      headers: authHeaders,
      payload: {
        phone: TEST_PHONE_1,
        name: 'Prueba E2E Uno',
        is_whitelisted: false,
      },
    });
    expect(createRes1.statusCode).toBe(201);
    const created1 = createRes1.json<{ ok: boolean; contact: Contact }>().contact;
    expect(created1.jid).toBe(TEST_JID_1);
    expect(created1.is_whitelisted).toBe(false);

    // Intento con contacto existente pero is_whitelisted=false -> 403
    const blockedExisting = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/send',
      headers: authHeaders,
      payload: {
        contactId: created1.id,
        text: 'Todavía no está en whitelist',
      },
    });
    expect(blockedExisting.statusCode).toBe(403);

    // Autorizar 3764358152 vía PATCH whitelist
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/contacts/${created1.id}/whitelist`,
      headers: authHeaders,
      payload: { is_whitelisted: true },
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json<{ contact: Contact }>().contact.is_whitelisted).toBe(true);

    // Envío hacia 3764358152 ahora devuelve 202
    const allowedRes1 = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/send',
      headers: authHeaders,
      payload: {
        phone: TEST_PHONE_1,
        text: 'Hola 3764358152 autorizado por whitelist',
      },
    });
    expect(allowedRes1.statusCode).toBe(202);
    expect(allowedRes1.json<{ duplicated: boolean }>().duplicated).toBe(false);

    // Alta directa whitelisted para 3765007805 y envío 202
    const createRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/contacts',
      headers: authHeaders,
      payload: {
        phone: TEST_PHONE_2,
        name: 'Prueba E2E Dos',
        is_whitelisted: true,
      },
    });
    expect(createRes2.statusCode).toBe(201);
    expect(createRes2.json<{ contact: Contact }>().contact.jid).toBe(TEST_JID_2);

    const allowedRes2 = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/send',
      headers: authHeaders,
      payload: {
        phone: TEST_PHONE_2,
        text: 'Hola 3765007805 autorizado por whitelist',
      },
    });
    expect(allowedRes2.statusCode).toBe(202);
    expect(queueDispatcher.enqueuedJobs).toHaveLength(2);
  });

  // Prueba 4: Idempotencia en POST /api/v1/messages/send
  it('4. Idempotencia: evita envíos duplicados con misma idempotency_key devolviendo 200 duplicated=true y un único job', async () => {
    const authHeaders = { 'x-api-key': env.MASTER_API_KEY };

    await dataStore.upsertContact({
      jid: TEST_JID_1,
      phone_number: '5493764358152',
      address_book_name: 'Contacto Idempotencia',
      is_whitelisted: true,
    });

    const firstRes = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/send',
      headers: authHeaders,
      payload: {
        phone: TEST_PHONE_1,
        text: 'Mensaje idempotente único',
        idempotency_key: 'idem-campaign-001',
      },
    });
    expect(firstRes.statusCode).toBe(202);
    const firstBody = firstRes.json<{
      ok: boolean;
      duplicated: boolean;
      job: { id: string };
    }>();
    expect(firstBody.duplicated).toBe(false);

    const secondRes = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/send',
      headers: authHeaders,
      payload: {
        phone: TEST_PHONE_1,
        text: 'Mensaje idempotente único',
        idempotency_key: 'idem-campaign-001',
      },
    });
    expect(secondRes.statusCode).toBe(200);
    const secondBody = secondRes.json<{
      ok: boolean;
      duplicated: boolean;
      job: { id: string };
    }>();
    expect(secondBody.duplicated).toBe(true);
    expect(secondBody.job.id).toBe(firstBody.job.id);
    expect(queueDispatcher.enqueuedJobs).toHaveLength(1);
  });

  // Prueba 5: Smart Drip Scheduler (Jitter 4-12s, pausa 45-90s cada 15 mensajes y SAFE_HOURS)
  it('5. Smart Drip: distribuye 20 envíos con jitter 4-12s, pausa larga de 45-90s en el envío #16 y pospone 22:00 al día siguiente 08:30', async () => {
    const authHeaders = { 'x-api-key': env.MASTER_API_KEY };

    const phones: string[] = [TEST_PHONE_1, TEST_PHONE_2];
    for (let i = 1; i <= 18; i++) {
      phones.push(`37640000${String(i).padStart(2, '0')}`);
    }

    for (const phone of phones) {
      await dataStore.upsertContact({
        jid: formatToJid(phone),
        phone_number: formatToJid(phone).split('@')[0],
        address_book_name: `Lote ${phone}`,
        is_whitelisted: true,
      });
    }

    // Hora local 09:00 AM dentro de SAFE_HOURS (08:30 - 20:30)
    const morningLocal = new Date(2026, 10, 20, 9, 0, 0, 0);
    const batchRes = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/schedule',
      headers: authHeaders,
      payload: {
        phones,
        text: 'Campaña Smart Drip 20 contactos',
        scheduledFor: morningLocal.toISOString(),
        urgent: false,
      },
    });
    expect(batchRes.statusCode).toBe(202);
    const batchBody = batchRes.json<{
      ok: boolean;
      count: number;
      jobs: Array<{ id: string; effective_send_at: string }>;
    }>();
    expect(batchBody.ok).toBe(true);
    expect(batchBody.count).toBe(20);
    expect(batchBody.jobs).toHaveLength(20);

    const timestamps = batchBody.jobs.map((j) =>
      new Date(j.effective_send_at).getTime()
    );
    expect(timestamps[0]).toBe(morningLocal.getTime());

    for (let i = 1; i < timestamps.length; i++) {
      const diffMs = timestamps[i] - timestamps[i - 1];
      if (i === 15) {
        // Pausa larga obligatoria después de los primeros 15 mensajes (45s - 90s)
        expect(diffMs).toBeGreaterThanOrEqual(45000);
        expect(diffMs).toBeLessThanOrEqual(90000);
      } else {
        // Jitter estándar entre 4s y 12s
        expect(diffMs).toBeGreaterThanOrEqual(4000);
        expect(diffMs).toBeLessThanOrEqual(12000);
      }
    }

    // Programación nocturna a las 22:00 local sin flag urgent -> reprogramada al día siguiente 08:30
    const nightLocal = new Date(2026, 10, 20, 22, 0, 0, 0);
    const nightRes = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/schedule',
      headers: authHeaders,
      payload: {
        phone: TEST_PHONE_1,
        text: 'Mensaje fuera de franja horaria',
        scheduledFor: nightLocal.toISOString(),
        urgent: false,
      },
    });
    expect(nightRes.statusCode).toBe(202);
    const clampedAt = new Date(
      nightRes.json<{ jobs: Array<{ effective_send_at: string }> }>().jobs[0]
        .effective_send_at
    );
    const expectedNextMorning = new Date(2026, 10, 21, 8, 30, 0, 0);
    expect(clampedAt.getFullYear()).toBe(expectedNextMorning.getFullYear());
    expect(clampedAt.getMonth()).toBe(expectedNextMorning.getMonth());
    expect(clampedAt.getDate()).toBe(expectedNextMorning.getDate());
    expect(clampedAt.getHours()).toBe(8);
    expect(clampedAt.getMinutes()).toBe(30);

    // Con urgent: true respeta las 22:00 exactamente
    const urgentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/messages/schedule',
      headers: authHeaders,
      payload: {
        phone: TEST_PHONE_2,
        text: 'Mensaje urgente nocturno',
        scheduledFor: nightLocal.toISOString(),
        urgent: true,
      },
    });
    expect(urgentRes.statusCode).toBe(202);
    const urgentAt = new Date(
      urgentRes.json<{ jobs: Array<{ effective_send_at: string }> }>().jobs[0]
        .effective_send_at
    );
    expect(urgentAt.getTime()).toBe(nightLocal.getTime());
  });

  // Prueba 6: Salvaguarda de Celular Físico (Evolution Webhook fromMe=true sin cache -> HUMAN_TAKEOVER)
  it('6. Salvaguarda Celular Físico: silencia la IA a HUMAN_TAKEOVER (~24h) ante respuesta manual no cacheada y mantiene AI_RETENTION si vino del sistema', async () => {
    const contactPhone1 = await dataStore.upsertContact({
      jid: TEST_JID_1,
      phone_number: '5493764358152',
      address_book_name: 'Cliente Celular Físico',
      is_whitelisted: true,
      ai_mode: 'AI_RETENTION',
      ai_muted_until: null,
    });

    const contactPhone2 = await dataStore.upsertContact({
      jid: TEST_JID_2,
      phone_number: '5493765007805',
      address_book_name: 'Cliente Bot Cacheado',
      is_whitelisted: true,
      ai_mode: 'AI_RETENTION',
      ai_muted_until: null,
    });

    const beforeMs = Date.now();

    // Dueño responde desde su teléfono físico -> ID NO está en sent_cache
    const manualWebhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/evolution',
      payload: {
        event: 'messages.upsert',
        instance: env.INSTANCE_NAME,
        data: {
          key: {
            remoteJid: TEST_JID_1,
            fromMe: true,
            id: 'WA_MOBILE_UNTRACKED_001',
          },
          message: {
            conversation: 'Hola, te atiendo directo desde mi teléfono.',
          },
        },
      },
    });
    expect(manualWebhookRes.statusCode).toBe(200);
    expect(manualWebhookRes.json<{ received: boolean }>().received).toBe(true);

    const updatedContact1 = await dataStore.getContactById(contactPhone1.id);
    expect(updatedContact1?.ai_mode).toBe('HUMAN_TAKEOVER');
    expect(updatedContact1?.ai_muted_until).toBeInstanceOf(Date);
    expect(updatedContact1!.ai_muted_until!.getTime()).toBeGreaterThanOrEqual(
      beforeMs + 23 * 3600 * 1000
    );

    const msgs1 = await dataStore.listMessagesByContact(contactPhone1.id);
    expect(msgs1.some((m) => m.sender_type === 'HUMAN_OWNER')).toBe(true);

    // Mensaje enviado por el propio worker del sistema -> ID SÍ está en sent_cache
    await queueDispatcher.markMessageSentBySystem('WA_SYSTEM_TRACKED_002');
    const systemWebhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/evolution',
      payload: {
        event: 'messages.upsert',
        instance: env.INSTANCE_NAME,
        data: {
          key: {
            remoteJid: TEST_JID_2,
            fromMe: true,
            id: 'WA_SYSTEM_TRACKED_002',
          },
          message: {
            conversation: 'Respuesta automática registrada en sent_cache.',
          },
        },
      },
    });
    expect(systemWebhookRes.statusCode).toBe(200);

    const updatedContact2 = await dataStore.getContactById(contactPhone2.id);
    expect(updatedContact2?.ai_mode).toBe('AI_RETENTION');
    expect(updatedContact2?.ai_muted_until).toBeNull();
  });

  // Prueba 7: Botón de pánico de cola y sincronización de libreta/difusiones
  it('7. Queue Toggle & Contact Sync: pausa/reanuda la cola global y sincroniza libreta y listas de difusión vía IMessagingProvider', async () => {
    const authHeaders = { 'x-api-key': env.MASTER_API_KEY };

    // Pausar cola explícitamente
    const pauseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/queue/toggle',
      headers: authHeaders,
      payload: { paused: true },
    });
    expect(pauseRes.statusCode).toBe(200);
    expect(pauseRes.json<{ ok: boolean; paused: boolean }>().paused).toBe(true);

    const pausedHealth = await app.inject({
      method: 'GET',
      url: '/api/v1/system/health',
      headers: authHeaders,
    });
    expect(pausedHealth.json<{ queuePaused: boolean }>().queuePaused).toBe(true);

    // Toggle sin body debe reanudar (false)
    const resumeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/queue/toggle',
      headers: authHeaders,
    });
    expect(resumeRes.statusCode).toBe(200);
    expect(resumeRes.json<{ paused: boolean }>().paused).toBe(false);

    // Sincronizar contactos + difusiones mediante proveedor inyectado
    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/contacts/sync',
      headers: authHeaders,
    });
    expect(syncRes.statusCode).toBe(200);
    const syncBody = syncRes.json<{
      ok: boolean;
      synced: number;
      contacts: Contact[];
    }>();
    expect(syncBody.ok).toBe(true);
    expect(syncBody.synced).toBe(2);
    expect(syncBody.contacts.map((c) => c.jid)).toEqual([TEST_JID_1, TEST_JID_2]);

    const broadcastListRes = await app.inject({
      method: 'GET',
      url: '/api/v1/contacts?isInBroadcast=true',
      headers: authHeaders,
    });
    expect(broadcastListRes.statusCode).toBe(200);
    const broadcastContacts = broadcastListRes.json<{ contacts: Contact[] }>().contacts;
    expect(broadcastContacts).toHaveLength(2);
    expect(
      broadcastContacts.every(
        (c) =>
          c.is_in_broadcast &&
          c.broadcast_lists.includes('lista_clientes_vip@broadcast')
      )
    ).toBe(true);
  });
});
