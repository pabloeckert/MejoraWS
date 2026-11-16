import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  formatToJid,
  type AIConfig,
  type AIMode,
  type ApiKey,
  type ConnectionStatusResult,
  type Contact,
  type IMessagingProvider,
  type JobStatus,
  type Message,
  type MessageStatus,
  type OutboundMessageContent,
  type OwnerAlertPayload,
  type ScheduledJob,
  type SendResult,
} from '@mejoraws/shared';
import { buildApp } from '../apps/orchestrator-api/src/app.js';
import { env } from '../apps/orchestrator-api/src/config/env.js';
import type {
  ContactListFilters,
  DailyMetrics,
  IDataStore,
  IQueueDispatcher,
} from '../apps/orchestrator-api/src/domain/ports.js';
import type { IWorkerDataStore } from '../apps/orchestrator-worker/src/domain/ports.js';
import { InMemorySentCacheAndLimiter } from '../apps/orchestrator-worker/src/infrastructure/cache/SentCacheAndLimiter.js';
import { OutboundMessageProcessor } from '../apps/orchestrator-worker/src/application/OutboundMessageProcessor.js';
import {
  DashboardApiClient,
  contactsToCsv,
  getSenderBadge,
} from '../apps/dashboard-ui/src/api/dashboardClient.js';

const TEST_PHONE_1 = '3764358152';
const TEST_PHONE_2 = '3765007805';
const TEST_JID_1 = formatToJid(TEST_PHONE_1); // 5493764358152@s.whatsapp.net
const TEST_JID_2 = formatToJid(TEST_PHONE_2); // 5493765007805@s.whatsapp.net

/**
 * Adaptador unificado de persistencia en memoria para certificar en una sola ejecución
 * el flujo API <-> Cola <-> Worker con idéntica semántica que PostgresDataStore / PostgresWorkerStore.
 */
class UnifiedAcceptanceDataStore implements IDataStore, IWorkerDataStore {
  private readonly contacts = new Map<string, Contact>();
  private readonly jidIndex = new Map<string, string>();
  private readonly messages = new Map<string, Message>();
  private readonly jobs = new Map<string, ScheduledJob>();
  private readonly idempotencyIndex = new Map<string, string>();
  private readonly apiKeys = new Map<string, ApiKey>();

  private aiConfig: AIConfig = {
    id: 1,
    is_global_enabled: true,
    system_prompt:
      'Eres el asistente de atención y retención de Mejora Continua. Tu tono es empático, profesional, natural y humano.',
    model_name: env.AI_MODEL || 'gpt-4o-mini',
    max_auto_turns: 2,
    handoff_keywords: [
      'precio',
      'comprar',
      'reunion',
      'llamame',
      'asesor',
      'info',
      'costo',
    ],
    auto_mute_hours_on_human_reply: 24,
    alert_webhook_url: null,
  };

  async upsertContact(
    data: Partial<Contact> & { jid: string; phone_number: string }
  ): Promise<Contact> {
    const existingId = this.jidIndex.get(data.jid);
    if (existingId) {
      const current = this.contacts.get(existingId)!;
      const mergedBroadcasts = data.broadcast_lists
        ? Array.from(
            new Set([...current.broadcast_lists, ...data.broadcast_lists])
          )
        : current.broadcast_lists;

      const updated: Contact = {
        ...current,
        instance_id: data.instance_id ?? current.instance_id,
        phone_number: data.phone_number || current.phone_number,
        push_name:
          data.push_name !== undefined ? data.push_name : current.push_name,
        address_book_name:
          data.address_book_name !== undefined
            ? data.address_book_name
            : current.address_book_name,
        is_in_broadcast:
          data.is_in_broadcast !== undefined
            ? current.is_in_broadcast || data.is_in_broadcast
            : current.is_in_broadcast,
        broadcast_lists: mergedBroadcasts,
        ai_mode: data.ai_mode ?? current.ai_mode,
        ai_muted_until:
          data.ai_muted_until !== undefined
            ? data.ai_muted_until
            : current.ai_muted_until,
        is_whitelisted:
          data.is_whitelisted !== undefined
            ? data.is_whitelisted
            : current.is_whitelisted,
        metadata: data.metadata
          ? { ...current.metadata, ...data.metadata }
          : current.metadata,
        last_interaction_at:
          data.last_interaction_at !== undefined
            ? data.last_interaction_at
            : current.last_interaction_at,
      };
      this.contacts.set(existingId, updated);
      return updated;
    }

    const created: Contact = {
      id: data.id || randomUUID(),
      instance_id: data.instance_id || env.INSTANCE_NAME,
      jid: data.jid,
      phone_number: data.phone_number,
      push_name: data.push_name ?? null,
      address_book_name: data.address_book_name ?? null,
      is_in_broadcast: data.is_in_broadcast ?? false,
      broadcast_lists: data.broadcast_lists ?? [],
      ai_mode: data.ai_mode ?? 'AI_RETENTION',
      ai_muted_until: data.ai_muted_until ?? null,
      is_whitelisted: data.is_whitelisted ?? false,
      metadata: data.metadata ?? {},
      last_interaction_at: data.last_interaction_at ?? null,
      created_at: new Date(),
    };
    this.contacts.set(created.id, created);
    this.jidIndex.set(created.jid, created.id);
    return created;
  }

  async getContactById(id: string): Promise<Contact | null> {
    return this.contacts.get(id) ?? null;
  }

  async getContactByJid(jid: string): Promise<Contact | null> {
    const id = this.jidIndex.get(jid);
    return id ? this.contacts.get(id) ?? null : null;
  }

  async findContactByLid(lid: string): Promise<Contact | null> {
    for (const contact of this.contacts.values()) {
      if (
        contact.jid === lid ||
        contact.metadata?.lid === lid ||
        contact.metadata?.remoteJidAlt === lid
      ) {
        return contact;
      }
    }
    return null;
  }

  async recordAIUsage(_data: any): Promise<void> {}

  async listContacts(filters?: ContactListFilters): Promise<Contact[]> {
    let list = Array.from(this.contacts.values());
    if (filters?.isInBroadcast !== undefined) {
      list = list.filter((c) => c.is_in_broadcast === filters.isInBroadcast);
    }
    if (filters?.aiMode) {
      list = list.filter((c) => c.ai_mode === filters.aiMode);
    }
    if (filters?.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.push_name || '').toLowerCase().includes(q) ||
          (c.address_book_name || '').toLowerCase().includes(q) ||
          c.phone_number.toLowerCase().includes(q) ||
          c.jid.toLowerCase().includes(q)
      );
    }
    return list;
  }

  async updateContactMode(
    contactId: string,
    aiMode: AIMode,
    mutedUntil: Date | null = null
  ): Promise<Contact | null> {
    const c = this.contacts.get(contactId);
    if (!c) return null;
    const updated: Contact = {
      ...c,
      ai_mode: aiMode,
      ai_muted_until: mutedUntil,
    };
    this.contacts.set(contactId, updated);
    return updated;
  }

  async updateContactWhitelist(
    contactId: string,
    isWhitelisted: boolean
  ): Promise<Contact | null> {
    const c = this.contacts.get(contactId);
    if (!c) return null;
    const updated: Contact = { ...c, is_whitelisted: isWhitelisted };
    this.contacts.set(contactId, updated);
    return updated;
  }

  async updateContactMetadata(
    contactId: string,
    metadataPatch: Record<string, unknown>
  ): Promise<Contact | null> {
    const c = this.contacts.get(contactId);
    if (!c) return null;
    const updated: Contact = {
      ...c,
      metadata: { ...c.metadata, ...metadataPatch },
    };
    this.contacts.set(contactId, updated);
    return updated;
  }

  async createMessage(
    msg: Omit<Message, 'id' | 'created_at'>
  ): Promise<Message> {
    for (const existing of this.messages.values()) {
      if (existing.whatsapp_message_id === msg.whatsapp_message_id) {
        return existing;
      }
    }
    const created: Message = {
      ...msg,
      id: randomUUID(),
      instance_id: msg.instance_id || env.INSTANCE_NAME,
      created_at: new Date(),
    };
    this.messages.set(created.id, created);
    return created;
  }

  async updateMessageStatus(
    whatsappMessageId: string,
    status: MessageStatus
  ): Promise<void> {
    for (const [id, msg] of this.messages.entries()) {
      if (msg.whatsapp_message_id === whatsappMessageId) {
        this.messages.set(id, { ...msg, status });
        return;
      }
    }
  }

  async updatePendingJobMessage(
    jobId: string,
    whatsappMessageId: string,
    status: MessageStatus,
    renderedBody?: string
  ): Promise<void> {
    const pendingId = `pending_${jobId}`;
    for (const [id, msg] of this.messages.entries()) {
      if (msg.whatsapp_message_id === pendingId) {
        this.messages.set(id, {
          ...msg,
          whatsapp_message_id: whatsappMessageId,
          status,
          body: renderedBody !== undefined ? renderedBody : msg.body,
        });
        return;
      }
    }
  }

  async listMessagesByContact(
    contactId: string,
    limit = 100
  ): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter((m) => m.contact_id === contactId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .slice(-limit);
  }

  async findJobByIdempotencyKey(key: string): Promise<ScheduledJob | null> {
    const id = this.idempotencyIndex.get(key);
    return id ? this.jobs.get(id) ?? null : null;
  }

  async getScheduledJobById(id: string): Promise<ScheduledJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async createScheduledJob(
    job: Omit<ScheduledJob, 'id' | 'created_at' | 'attempts' | 'error_log'>
  ): Promise<ScheduledJob> {
    const created: ScheduledJob = {
      ...job,
      id: randomUUID(),
      instance_id: job.instance_id || env.INSTANCE_NAME,
      attempts: 0,
      error_log: null,
      created_at: new Date(),
    };
    this.jobs.set(created.id, created);
    if (created.idempotency_key) {
      this.idempotencyIndex.set(created.idempotency_key, created.id);
    }
    return created;
  }

  async listScheduledJobs(status?: JobStatus): Promise<ScheduledJob[]> {
    let list = Array.from(this.jobs.values());
    if (status) list = list.filter((j) => j.status === status);
    return list.sort(
      (a, b) => a.effective_send_at.getTime() - b.effective_send_at.getTime()
    );
  }

  async listScheduledJobsByStatus(status: JobStatus): Promise<ScheduledJob[]> {
    return this.listScheduledJobs(status);
  }

  async updateScheduledJob(
    id: string,
    patch: Partial<
      Pick<
        ScheduledJob,
        | 'scheduled_for'
        | 'effective_send_at'
        | 'status'
        | 'attempts'
        | 'error_log'
      >
    >
  ): Promise<ScheduledJob | null> {
    const j = this.jobs.get(id);
    if (!j) return null;
    const updated: ScheduledJob = { ...j, ...patch };
    this.jobs.set(id, updated);
    return updated;
  }

  async getAIConfig(): Promise<AIConfig> {
    return { ...this.aiConfig };
  }

  async updateAIConfig(patch: Partial<AIConfig>): Promise<AIConfig> {
    this.aiConfig = { ...this.aiConfig, ...patch, id: 1 };
    return { ...this.aiConfig };
  }

  async validateApiKeyHash(keyHash: string): Promise<boolean> {
    for (const k of this.apiKeys.values()) {
      if (k.key_hash === keyHash && k.is_active) return true;
    }
    return false;
  }

  async listApiKeys(): Promise<ApiKey[]> {
    return Array.from(this.apiKeys.values());
  }

  async createApiKey(label: string, keyHash: string): Promise<ApiKey> {
    const created: ApiKey = {
      id: randomUUID(),
      label,
      key_hash: keyHash,
      is_active: true,
      created_at: new Date(),
    };
    this.apiKeys.set(created.id, created);
    return created;
  }

  async getDailyMetrics(): Promise<DailyMetrics> {
    return {
      sentToday: Array.from(this.messages.values()).filter(
        (m) => m.direction === 'OUTBOUND' && m.status !== 'QUEUED'
      ).length,
      receivedToday: Array.from(this.messages.values()).filter(
        (m) => m.direction === 'INBOUND'
      ).length,
      pendingJobs: Array.from(this.jobs.values()).filter(
        (j) => j.status === 'PENDING' || j.status === 'PROCESSING'
      ).length,
      failedToday: Array.from(this.messages.values()).filter(
        (m) => m.status === 'FAILED'
      ).length,
    };
  }
}

/**
 * Cola y sent_cache compartidos entre orchestrator-api y orchestrator-worker.
 */
class UnifiedQueueAndCache
  extends InMemorySentCacheAndLimiter
  implements IQueueDispatcher
{
  public readonly enqueuedJobs: Array<{ job: ScheduledJob; delayMs: number }> =
    [];

  async enqueueOutboundJob(job: ScheduledJob, delayMs: number): Promise<void> {
    this.enqueuedJobs.push({ job, delayMs: Math.max(0, Math.round(delayMs)) });
  }

  async cancelOutboundJob(jobId: string): Promise<void> {
    const idx = this.enqueuedJobs.findIndex((i) => i.job.id === jobId);
    if (idx !== -1) this.enqueuedJobs.splice(idx, 1);
  }

  public readonly enqueuedAIPayloads: any[] = [];
  private realtimeListeners = new Set<(event: any) => void>();

  async enqueueInboundAI(payload: any): Promise<void> {
    this.enqueuedAIPayloads.push(payload);
  }

  async publishRealtimeEvent(event: any): Promise<void> {
    for (const listener of this.realtimeListeners) {
      try {
        listener(event);
      } catch {
        // ignore
      }
    }
  }

  async subscribeRealtimeEvents(listener: (event: any) => void): Promise<() => void> {
    this.realtimeListeners.add(listener);
    return () => {
      this.realtimeListeners.delete(listener);
    };
  }
}

/**
 * Puente HTTP fetch -> app.inject() con jarra de cookies para simular el navegador del Dashboard.
 */
function createAppInjectFetchBridge(app: FastifyInstance): typeof fetch {
  const cookieJar = new Map<string, string>();

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = String(input);
    const parsedUrl = rawUrl.startsWith('http')
      ? new URL(rawUrl)
      : new URL(rawUrl, 'http://localhost:3000');

    const headers: Record<string, string> = {};
    if (init?.headers) {
      for (const [k, v] of Object.entries(
        init.headers as Record<string, string>
      )) {
        headers[k.toLowerCase()] = v;
      }
    }

    if (cookieJar.size > 0) {
      headers['cookie'] = Array.from(cookieJar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    }

    const res = await app.inject({
      method: (init?.method || 'GET') as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      url: `${parsedUrl.pathname}${parsedUrl.search}`,
      headers,
      payload: init?.body ? String(init.body) : undefined,
    });

    const rawSetCookie = res.headers['set-cookie'];
    const cookieList = Array.isArray(rawSetCookie)
      ? rawSetCookie
      : rawSetCookie
      ? [rawSetCookie]
      : [];
    for (const c of cookieList) {
      const pair = c.split(';')[0];
      const eq = pair.indexOf('=');
      if (eq !== -1) {
        cookieJar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    }

    return new Response(res.payload, {
      status: res.statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('CERTIFICACIÓN PRD v1.0 — Integración End-to-End Dashboard + API + Worker (3764358152 & 3765007805)', () => {
  let dataStore: UnifiedAcceptanceDataStore;
  let queueAndCache: UnifiedQueueAndCache;
  let callLog: string[];
  let msgSeq: number;
  let messagingProvider: IMessagingProvider;
  let app: FastifyInstance;
  let dashboardClient: DashboardApiClient;
  let workerProcessor: OutboundMessageProcessor;

  beforeEach(async () => {
    dataStore = new UnifiedAcceptanceDataStore();
    queueAndCache = new UnifiedQueueAndCache();
    callLog = [];
    msgSeq = 0;

    messagingProvider = {
      presenceSubscribe: vi.fn(async (jid: string) => {
        callLog.push(`presenceSubscribe:${jid}`);
      }),
      sendPresenceUpdate: vi.fn(
        async (
          jid: string,
          type: 'composing' | 'paused' | 'available' | 'unavailable'
        ) => {
          callLog.push(`presence:${type}:${jid}`);
        }
      ),
      sendMessage: vi.fn(
        async (
          jid: string,
          content: OutboundMessageContent
        ): Promise<SendResult> => {
          msgSeq++;
          const waId = `WA_E2E_MSG_${msgSeq}`;
          callLog.push(`sendMessage:${jid}:${content.contentType}:${waId}`);
          return {
            messageId: waId,
            status: 'SENT',
            timestamp: new Date(),
          };
        }
      ),
      syncContacts: vi.fn(async () => [
        {
          instance_id: env.INSTANCE_NAME,
          jid: TEST_JID_1,
          phone_number: '5493764358152',
          push_name: 'Contacto 3764358152',
          address_book_name: 'Prueba Uno Misiones',
          is_in_broadcast: true,
          broadcast_lists: ['difusion_vip@broadcast'],
        },
        {
          instance_id: env.INSTANCE_NAME,
          jid: TEST_JID_2,
          phone_number: '5493765007805',
          push_name: 'Contacto 3765007805',
          address_book_name: 'Prueba Dos Misiones',
          is_in_broadcast: true,
          broadcast_lists: ['difusion_vip@broadcast'],
        },
      ]),
      getConnectionStatus: vi.fn(
        async (): Promise<ConnectionStatusResult> => ({
          state: 'connected',
          instanceName: env.INSTANCE_NAME,
          phone: '5493764000000',
        })
      ),
    };

    app = await buildApp({
      dataStore,
      queueDispatcher: queueAndCache,
      messagingProvider,
      enforceWhitelist: true,
      logger: false,
    });

    dashboardClient = new DashboardApiClient({
      baseUrl: 'http://localhost:3000',
      fetchImpl: createAppInjectFetchBridge(app),
    });

    workerProcessor = new OutboundMessageProcessor({
      dataStore,
      sentCache: queueAndCache,
      messagingProvider,
      enforceWhitelist: true,
      safeHoursStart: '08:30',
      safeHoursEnd: '20:30',
      sleepFn: async (ms) => {
        callLog.push(`typing_wait:${ms}`);
      },
    });
  });

  it('CA-1: Seguridad, Login JWT HttpOnly, API Keys sk_live_ y Cortafuegos Whitelist para 3764358152 y 3765007805', async () => {
    // 1. Rechazo 401 sin sesión ni x-api-key
    await expect(dashboardClient.getHealth()).rejects.toThrow(/x-api-key|JWT/i);

    // 2. Login maestro emite cookie HttpOnly usada automáticamente por la sesión
    const loginRes = await dashboardClient.login(
      env.ADMIN_USER,
      env.ADMIN_PASSWORD
    );
    expect(loginRes.ok).toBe(true);
    expect(loginRes.user).toBe(env.ADMIN_USER);

    const health = await dashboardClient.getHealth();
    expect(health.ok).toBe(true);
    expect(health.enforceWhitelist).toBe(true);

    // 3. Crear llave x-api-key dinámica y validar cliente externo sin cookie
    const createdKey = await dashboardClient.createApiKey('Apps Script CRM');
    expect(createdKey.apiKey.startsWith('sk_live_')).toBe(true);

    const externalClient = new DashboardApiClient({
      baseUrl: 'http://localhost:3000',
      apiKey: createdKey.apiKey,
      fetchImpl: createAppInjectFetchBridge(app),
    });
    const externalHealth = await externalClient.getHealth();
    expect(externalHealth.ok).toBe(true);

    // 4. Cortafuegos Whitelist bloquea con 403 antes de autorizar
    await expect(
      dashboardClient.sendMessageNow({
        phone: TEST_PHONE_1,
        text: 'Intento sin whitelist',
      })
    ).rejects.toThrow(/whitelist/i);

    // 5. Alta de 3764358152 (bloqueado -> habilitado por PATCH) y 3765007805
    const c1Res = await dashboardClient.createContact({
      phone: TEST_PHONE_1,
      name: 'Prueba Uno',
      is_whitelisted: false,
    });
    expect(c1Res.contact.jid).toBe(TEST_JID_1);

    await expect(
      dashboardClient.sendMessageNow({
        contactId: c1Res.contact.id,
        text: 'Todavía bloqueado',
      })
    ).rejects.toThrow(/whitelist/i);

    const patch1 = await dashboardClient.setContactWhitelist(
      c1Res.contact.id,
      true
    );
    expect(patch1.contact.is_whitelisted).toBe(true);

    const c2Res = await dashboardClient.createContact({
      phone: TEST_PHONE_2,
      name: 'Prueba Dos',
      is_whitelisted: true,
    });
    expect(c2Res.contact.jid).toBe(TEST_JID_2);
    expect(c2Res.contact.is_whitelisted).toBe(true);
  });

  it('CA-2: Flujo Completo Dashboard -> API -> Cola -> Worker ("composing") -> sent_cache -> Eco fromMe -> READ ACK & Idempotencia', async () => {
    await dashboardClient.login(env.ADMIN_USER, env.ADMIN_PASSWORD);
    const { contact } = await dashboardClient.createContact({
      phone: TEST_PHONE_1,
      name: 'Carlos Posadas',
      is_whitelisted: true,
    });

    // 1. Dashboard encola envío con Spintax + plantilla + idempotency_key
    const sendRes = await dashboardClient.sendMessageNow({
      contactId: contact.id,
      text: '{Hola|Buen día} {nombre}, te acercamos la info solicitada.',
      contentType: 'TEXT',
      idempotency_key: 'ca2-e2e-001',
    });
    expect(sendRes.ok).toBe(true);
    expect(sendRes.duplicated).toBe(false);
    expect(queueAndCache.enqueuedJobs).toHaveLength(1);

    // 2. Worker consume el trabajo en horario hábil con simulación "composing"
    const daytime = new Date(2026, 10, 20, 10, 30, 0, 0);
    const workerRes = await workerProcessor.processJob(sendRes.job.id, daytime);
    expect(workerRes.outcome).toBe('SENT');
    expect(workerRes.typingDurationMs).toBeGreaterThanOrEqual(1500);
    expect(workerRes.typingDurationMs).toBeLessThanOrEqual(4000);
    expect(workerRes.renderedText).toMatch(/^(Hola|Buen día) Carlos Posadas/);

    expect(callLog).toEqual([
      `presenceSubscribe:${TEST_JID_1}`,
      `presence:composing:${TEST_JID_1}`,
      `typing_wait:${workerRes.typingDurationMs}`,
      `presence:paused:${TEST_JID_1}`,
      `sendMessage:${TEST_JID_1}:TEXT:${workerRes.whatsappMessageId}`,
    ]);

    // 3. El messageId quedó protegido en sent_cache
    expect(
      await queueAndCache.wasMessageSentBySystem(workerRes.whatsappMessageId!)
    ).toBe(true);

    // 4. Evolution Webhook reporta eco fromMe=true del propio sistema -> NO silencia IA
    const echoRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/evolution',
      payload: {
        event: 'messages.upsert',
        instance: env.INSTANCE_NAME,
        data: {
          key: {
            remoteJid: TEST_JID_1,
            fromMe: true,
            id: workerRes.whatsappMessageId,
          },
          message: { conversation: workerRes.renderedText },
        },
      },
    });
    expect(echoRes.statusCode).toBe(200);

    const afterEchoContact = await dataStore.getContactById(contact.id);
    expect(afterEchoContact?.ai_mode).toBe('AI_RETENTION');

    // 5. Evolution Webhook reporta messages.update READ -> double check azul
    const ackRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/evolution',
      payload: {
        event: 'messages.update',
        instance: env.INSTANCE_NAME,
        data: {
          key: { id: workerRes.whatsappMessageId },
          update: { status: 'READ' },
        },
      },
    });
    expect(ackRes.statusCode).toBe(200);

    const conv = await dashboardClient.getConversationMessages(contact.id);
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].status).toBe('READ');
    expect(getSenderBadge(conv.messages[0]).label).toBe('[Sistema · Smart Drip]');

    // 6. Reintento con misma idempotency_key -> bloqueado (duplicated=true, 1 solo job en cola)
    const retryRes = await dashboardClient.sendMessageNow({
      contactId: contact.id,
      text: '{Hola|Buen día} {nombre}, te acercamos la info solicitada.',
      idempotency_key: 'ca2-e2e-001',
    });
    expect(retryRes.duplicated).toBe(true);
    expect(retryRes.job.id).toBe(sendRes.job.id);
    expect(queueAndCache.enqueuedJobs).toHaveLength(1);
  });

  it('CA-3: Smart Drip (lote 20 envíos con pausa en #16, reprogramación SAFE_HOURS 22:00->08:30 y Botón de Pánico)', async () => {
    await dashboardClient.login(env.ADMIN_USER, env.ADMIN_PASSWORD);

    const phones = [TEST_PHONE_1, TEST_PHONE_2];
    for (let i = 1; i <= 18; i++) {
      phones.push(`37640010${String(i).padStart(2, '0')}`);
    }
    for (const phone of phones) {
      await dashboardClient.createContact({
        phone,
        name: `Lote ${phone}`,
        is_whitelisted: true,
      });
    }

    // 1. Lote de 20 envíos programado a las 09:00 local
    const morning = new Date(2026, 10, 20, 9, 0, 0, 0);
    const batch = await dashboardClient.scheduleMessages({
      phones,
      text: 'Campaña Smart Drip Lote',
      scheduledFor: morning.toISOString(),
      urgent: false,
    });
    expect(batch.count).toBe(20);
    expect(batch.jobs).toHaveLength(20);

    const times = batch.jobs.map((j) =>
      new Date(j.effective_send_at).getTime()
    );
    for (let i = 1; i < times.length; i++) {
      const diff = times[i] - times[i - 1];
      if (i === 15) {
        expect(diff).toBeGreaterThanOrEqual(45000);
        expect(diff).toBeLessThanOrEqual(90000);
      } else {
        expect(diff).toBeGreaterThanOrEqual(4000);
        expect(diff).toBeLessThanOrEqual(12000);
      }
    }

    // 2. Programación nocturna a las 22:00 local -> reprogramada al día siguiente 08:30
    const night = new Date(2026, 10, 20, 22, 0, 0, 0);
    const nightSched = await dashboardClient.scheduleMessages({
      phones: [TEST_PHONE_1],
      text: 'Nocturno pospuesto',
      scheduledFor: night.toISOString(),
      urgent: false,
    });
    const clampedAt = new Date(nightSched.jobs[0].effective_send_at);
    expect(clampedAt.getDate()).toBe(21);
    expect(clampedAt.getHours()).toBe(8);
    expect(clampedAt.getMinutes()).toBe(30);

    // 3. Botón de pánico global pausa y reanuda la ejecución real del Worker
    const panicOn = await dashboardClient.toggleQueue(true);
    expect(panicOn.paused).toBe(true);

    const skipped = await workerProcessor.processJob(
      batch.jobs[0].id,
      new Date(2026, 10, 20, 9, 5, 0, 0)
    );
    expect(skipped.outcome).toBe('SKIPPED_QUEUE_PAUSED');
    expect(messagingProvider.sendMessage).not.toHaveBeenCalled();

    const panicOff = await dashboardClient.toggleQueue(false);
    expect(panicOff.paused).toBe(false);

    const sentAfterResume = await workerProcessor.processJob(
      batch.jobs[0].id,
      new Date(2026, 10, 20, 9, 5, 1, 0)
    );
    expect(sentAfterResume.outcome).toBe('SENT');
    expect(messagingProvider.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('CA-4: Retención IA desde Webhook entrante, Escalado por Intención de Compra y Salvaguarda de Celular Físico', async () => {
    await dashboardClient.login(env.ADMIN_USER, env.ADMIN_PASSWORD);

    const { contact: contact1 } = await dashboardClient.createContact({
      phone: TEST_PHONE_1,
      name: 'Laura Misiones',
      is_whitelisted: true,
    });
    const { contact: contact2 } = await dashboardClient.createContact({
      phone: TEST_PHONE_2,
      name: 'Martín Posadas',
      is_whitelisted: true,
    });

    // 1. Mensaje entrante general de 3764358152 -> API encola respuesta AI_AGENT sin jerga robótica y mantiene AI_RETENTION
    const generalWebhook = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/evolution',
      payload: {
        event: 'messages.upsert',
        instance: env.INSTANCE_NAME,
        data: {
          key: {
            remoteJid: TEST_JID_1,
            fromMe: false,
            id: 'INBOUND_GEN_001',
          },
          pushName: 'Laura Misiones',
          message: {
            conversation: 'Hola, ¿atienden consultas en Posadas?',
          },
        },
      },
    });
    expect(generalWebhook.statusCode).toBe(200);
    expect(queueAndCache.enqueuedJobs).toHaveLength(1);

    const aiJob1 = queueAndCache.enqueuedJobs[0].job;
    const workerAi1 = await workerProcessor.processJob(
      aiJob1.id,
      new Date(2026, 10, 20, 12, 0, 0, 0)
    );
    expect(workerAi1.outcome).toBe('SENT');

    const c1AfterGeneral = await dataStore.getContactById(contact1.id);
    expect(c1AfterGeneral?.ai_mode).toBe('AI_RETENTION');

    const conv1General = await dashboardClient.getConversationMessages(
      contact1.id
    );
    const aiMsg1 = conv1General.messages.find(
      (m) => m.sender_type === 'AI_AGENT'
    );
    expect(aiMsg1).toBeDefined();
    expect(aiMsg1!.body).not.toMatch(
      /modelo de lenguaje|asistente virtual|transfiero/i
    );
    expect(getSenderBadge(aiMsg1!).label).toBe('[IA · Retención]');

    // 2. Mensaje entrante con intención comercial ("precio y coordinar una reunión") -> Escala, guarda last_ai_alert y pasa a HUMAN_TAKEOVER (+24h)
    const intentWebhook = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/evolution',
      payload: {
        event: 'messages.upsert',
        instance: env.INSTANCE_NAME,
        data: {
          key: {
            remoteJid: TEST_JID_1,
            fromMe: false,
            id: 'INBOUND_INTENT_002',
          },
          message: {
            conversation:
              'Perfecto, quiero saber el precio y coordinar una reunión.',
          },
        },
      },
    });
    expect(intentWebhook.statusCode).toBe(200);

    const c1Escalated = await dataStore.getContactById(contact1.id);
    expect(c1Escalated?.ai_mode).toBe('HUMAN_TAKEOVER');
    expect(c1Escalated?.ai_muted_until).toBeInstanceOf(Date);
    expect(c1Escalated!.ai_muted_until!.getTime()).toBeGreaterThan(
      Date.now() + 23 * 3600 * 1000
    );

    const alert = c1Escalated?.metadata?.last_ai_alert as
      | OwnerAlertPayload
      | undefined;
    expect(alert).toBeDefined();
    expect(alert!.reason).toBe('KEYWORD_MATCH');
    expect(alert!.summaryTwoLines.split('\n').filter(Boolean)).toHaveLength(2);

    // 3. Salvaguarda Celular Físico en 3765007805: fromMe=true sin estar en sent_cache -> HUMAN_TAKEOVER + [Tú - Web / Celular]
    const physicalReplyWebhook = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/evolution',
      payload: {
        event: 'messages.upsert',
        instance: env.INSTANCE_NAME,
        data: {
          key: {
            remoteJid: TEST_JID_2,
            fromMe: true,
            id: 'WA_PHYSICAL_PHONE_999',
          },
          message: {
            conversation: 'Hola, te respondo directo desde el celu.',
          },
        },
      },
    });
    expect(physicalReplyWebhook.statusCode).toBe(200);

    const c2Updated = await dataStore.getContactById(contact2.id);
    expect(c2Updated?.ai_mode).toBe('HUMAN_TAKEOVER');
    expect(c2Updated?.ai_muted_until).toBeInstanceOf(Date);

    const conv2 = await dashboardClient.getConversationMessages(contact2.id);
    expect(conv2.messages).toHaveLength(1);
    expect(conv2.messages[0].sender_type).toBe('HUMAN_OWNER');
    expect(getSenderBadge(conv2.messages[0]).label).toBe('[Tú - Web / Celular]');
  });

  it('CA-5: Sincronización de Libreta, Captura de Difusiones @broadcast y Exportación CSV (3764358152 & 3765007805)', async () => {
    await dashboardClient.login(env.ADMIN_USER, env.ADMIN_PASSWORD);

    // 1. Sincronización desde WhatsApp (Evolution API mock)
    const syncRes = await dashboardClient.syncContacts();
    expect(syncRes.ok).toBe(true);
    expect(syncRes.synced).toBe(2);
    expect(syncRes.contacts.map((c) => c.jid)).toEqual([TEST_JID_1, TEST_JID_2]);

    // 2. Captura de mensaje en lista de difusión (@broadcast) vía Webhook
    const broadcastWebhook = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/evolution',
      payload: {
        event: 'messages.upsert',
        instance: env.INSTANCE_NAME,
        data: {
          key: {
            remoteJid: 'difusion_vip@broadcast',
            participant: TEST_JID_1,
            fromMe: false,
            id: 'WA_BROADCAST_777',
          },
          message: {
            conversation: 'Consulta desde lista de difusión VIP',
          },
        },
      },
    });
    expect(broadcastWebhook.statusCode).toBe(200);

    const { contacts: broadcastContacts } = await dashboardClient.listContacts({
      isInBroadcast: true,
    });
    expect(broadcastContacts).toHaveLength(2);

    const contact1 = broadcastContacts.find((c) => c.jid === TEST_JID_1)!;
    const conv1 = await dashboardClient.getConversationMessages(contact1.id);
    const broadcastMsg = conv1.messages.find((m) => m.is_broadcast);
    expect(broadcastMsg).toBeDefined();
    expect(broadcastMsg!.content_type).toBe('BROADCAST_CAPTURE');
    expect(getSenderBadge(broadcastMsg!).label).toBe('[Contacto · Difusión]');

    // 3. Exportación CSV de contactos y difusiones desde la lógica del Dashboard
    const csv = contactsToCsv(broadcastContacts);
    expect(csv).toContain(TEST_JID_1);
    expect(csv).toContain(TEST_JID_2);
    expect(csv).toContain('difusion_vip@broadcast');
  });
});
