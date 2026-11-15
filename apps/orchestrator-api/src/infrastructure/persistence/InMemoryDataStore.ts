import { randomUUID } from 'node:crypto';
import type {
  AIConfig,
  AIMode,
  ApiKey,
  Contact,
  JobStatus,
  Message,
  MessageStatus,
  ScheduledJob,
} from '@mejoraws/shared';
import type {
  ContactListFilters,
  DailyMetrics,
  IDataStore,
} from '../../domain/ports.js';
import { env } from '../../config/env.js';

export class InMemoryDataStore implements IDataStore {
  private contacts = new Map<string, Contact>();
  private jidIndex = new Map<string, string>();
  private messages = new Map<string, Message>();
  private jobs = new Map<string, ScheduledJob>();
  private idempotencyIndex = new Map<string, string>();
  private apiKeys = new Map<string, ApiKey>();

  private aiConfig: AIConfig = {
    id: 1,
    is_global_enabled: true,
    system_prompt:
      'Eres el asistente de atención y retención de Mejora Continua. Tu tono es empático, profesional, natural y humano. Respondes con brevedad para clarificar y contener.',
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
    auto_mute_hours_on_human_reply: env.AI_AUTO_MUTE_HOURS_ON_HUMAN_REPLY || 24,
    alert_webhook_url: env.OWNER_ALERT_WEBHOOK_URL || null,
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

    const id = data.id || randomUUID();
    const created: Contact = {
      id,
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
    this.contacts.set(id, created);
    this.jidIndex.set(created.jid, id);
    return created;
  }

  async getContactById(id: string): Promise<Contact | null> {
    return this.contacts.get(id) ?? null;
  }

  async getContactByJid(jid: string): Promise<Contact | null> {
    const id = this.jidIndex.get(jid);
    if (!id) return null;
    return this.contacts.get(id) ?? null;
  }

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

    return list.sort((a, b) => {
      const ta = a.last_interaction_at?.getTime() ?? a.created_at.getTime();
      const tb = b.last_interaction_at?.getTime() ?? b.created_at.getTime();
      return tb - ta;
    });
  }

  async updateContactMode(
    contactId: string,
    aiMode: AIMode,
    mutedUntil: Date | null = null
  ): Promise<Contact | null> {
    const contact = this.contacts.get(contactId);
    if (!contact) return null;
    const updated: Contact = {
      ...contact,
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
    const contact = this.contacts.get(contactId);
    if (!contact) return null;
    const updated: Contact = {
      ...contact,
      is_whitelisted: isWhitelisted,
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

    const contact = this.contacts.get(msg.contact_id);
    if (contact) {
      this.contacts.set(contact.id, {
        ...contact,
        last_interaction_at: created.created_at,
      });
    }
    return created;
  }

  async updateMessageStatus(
    whatsappMessageId: string,
    status: MessageStatus
  ): Promise<void> {
    for (const [id, msg] of this.messages.entries()) {
      if (msg.whatsapp_message_id === whatsappMessageId) {
        this.messages.set(id, { ...msg, status });
        break;
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
    if (!id) return null;
    return this.jobs.get(id) ?? null;
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
    if (status) {
      list = list.filter((j) => j.status === status);
    }
    return list.sort(
      (a, b) => a.effective_send_at.getTime() - b.effective_send_at.getTime()
    );
  }

  async updateScheduledJob(
    id: string,
    patch: Partial<
      Pick<
        ScheduledJob,
        'scheduled_for' | 'effective_send_at' | 'status' | 'attempts' | 'error_log'
      >
    >
  ): Promise<ScheduledJob | null> {
    const job = this.jobs.get(id);
    if (!job) return null;
    const updated: ScheduledJob = { ...job, ...patch };
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
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let sentToday = 0;
    let receivedToday = 0;
    let failedToday = 0;

    for (const m of this.messages.values()) {
      if (m.created_at < startOfDay) continue;
      if (
        m.direction === 'OUTBOUND' &&
        (m.status === 'SENT' || m.status === 'DELIVERED' || m.status === 'READ')
      ) {
        sentToday++;
      } else if (m.direction === 'INBOUND') {
        receivedToday++;
      } else if (m.status === 'FAILED') {
        failedToday++;
      }
    }

    let pendingJobs = 0;
    for (const j of this.jobs.values()) {
      if (j.status === 'PENDING' || j.status === 'PROCESSING') {
        pendingJobs++;
      }
    }

    return { sentToday, receivedToday, pendingJobs, failedToday };
  }
}
