import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type {
  AIConfig,
  AIMode,
  AIUsageLogRecord,
  Contact,
  JobStatus,
  Message,
  MessageStatus,
  ScheduledJob,
} from '@mejoraws/shared';
import type { IWorkerDataStore } from '../../domain/ports.js';
import { env } from '../../config/env.js';

const { Pool } = pg;

export class PostgresWorkerStore implements IWorkerDataStore {
  private readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async testConnection(): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async getContactById(id: string): Promise<Contact | null> {
    const res = await this.pool.query<Contact>(
      'SELECT * FROM contacts WHERE id = $1',
      [id]
    );
    return res.rows[0] ?? null;
  }

  async getContactByJid(jid: string): Promise<Contact | null> {
    const res = await this.pool.query<Contact>(
      'SELECT * FROM contacts WHERE jid = $1',
      [jid]
    );
    return res.rows[0] ?? null;
  }

  async upsertContact(
    data: Partial<Contact> & { jid: string; phone_number: string }
  ): Promise<Contact> {
    const query = `
      INSERT INTO contacts (
        instance_id, jid, phone_number, push_name, address_book_name,
        is_in_broadcast, broadcast_lists, ai_mode, ai_muted_until,
        is_whitelisted, metadata, last_interaction_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11::jsonb, $12)
      ON CONFLICT (jid) DO UPDATE SET
        phone_number = EXCLUDED.phone_number,
        push_name = COALESCE(EXCLUDED.push_name, contacts.push_name),
        address_book_name = COALESCE(EXCLUDED.address_book_name, contacts.address_book_name),
        is_in_broadcast = contacts.is_in_broadcast OR EXCLUDED.is_in_broadcast,
        metadata = contacts.metadata || EXCLUDED.metadata,
        last_interaction_at = COALESCE(EXCLUDED.last_interaction_at, contacts.last_interaction_at)
      RETURNING *
    `;

    const values = [
      data.instance_id || env.INSTANCE_NAME,
      data.jid,
      data.phone_number,
      data.push_name ?? null,
      data.address_book_name ?? null,
      data.is_in_broadcast ?? false,
      JSON.stringify(data.broadcast_lists ?? []),
      data.ai_mode ?? 'AI_RETENTION',
      data.ai_muted_until ?? null,
      data.is_whitelisted ?? false,
      JSON.stringify(data.metadata ?? {}),
      data.last_interaction_at ?? null,
    ];

    const res = await this.pool.query<Contact>(query, values);
    return res.rows[0];
  }

  async updateContactMode(
    contactId: string,
    aiMode: AIMode,
    mutedUntil: Date | null = null
  ): Promise<Contact | null> {
    const res = await this.pool.query<Contact>(
      `UPDATE contacts SET ai_mode = $2, ai_muted_until = $3 WHERE id = $1 RETURNING *`,
      [contactId, aiMode, mutedUntil]
    );
    return res.rows[0] ?? null;
  }

  async updateContactMetadata(
    contactId: string,
    metadataPatch: Record<string, unknown>
  ): Promise<Contact | null> {
    const res = await this.pool.query<Contact>(
      `UPDATE contacts SET metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb WHERE id = $1 RETURNING *`,
      [contactId, JSON.stringify(metadataPatch)]
    );
    return res.rows[0] ?? null;
  }

  async createMessage(
    msg: Omit<Message, 'id' | 'created_at'>
  ): Promise<Message> {
    const res = await this.pool.query<Message>(
      `
      INSERT INTO messages (
        instance_id, whatsapp_message_id, contact_id, direction, sender_type,
        content_type, body, media_url, media_filename, is_broadcast, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (whatsapp_message_id) DO UPDATE SET
        status = EXCLUDED.status,
        body = EXCLUDED.body
      RETURNING *
      `,
      [
        msg.instance_id || env.INSTANCE_NAME,
        msg.whatsapp_message_id,
        msg.contact_id,
        msg.direction,
        msg.sender_type,
        msg.content_type,
        msg.body,
        msg.media_url,
        msg.media_filename,
        msg.is_broadcast,
        msg.status,
      ]
    );

    await this.pool.query(
      'UPDATE contacts SET last_interaction_at = NOW() WHERE id = $1',
      [msg.contact_id]
    );

    return res.rows[0];
  }

  async updatePendingJobMessage(
    jobId: string,
    whatsappMessageId: string,
    status: MessageStatus,
    renderedBody?: string
  ): Promise<void> {
    const pendingKey = `pending_${jobId}`;
    if (renderedBody !== undefined) {
      await this.pool.query(
        `UPDATE messages SET whatsapp_message_id = $2, status = $3, body = $4 WHERE whatsapp_message_id = $1`,
        [pendingKey, whatsappMessageId, status, renderedBody]
      );
    } else {
      await this.pool.query(
        `UPDATE messages SET whatsapp_message_id = $2, status = $3 WHERE whatsapp_message_id = $1`,
        [pendingKey, whatsappMessageId, status]
      );
    }
  }

  async listMessagesByContact(
    contactId: string,
    limit = 100
  ): Promise<Message[]> {
    const res = await this.pool.query<Message>(
      `SELECT * FROM messages WHERE contact_id = $1 ORDER BY created_at ASC LIMIT $2`,
      [contactId, limit]
    );
    return res.rows;
  }

  async getScheduledJobById(id: string): Promise<ScheduledJob | null> {
    const res = await this.pool.query<ScheduledJob>(
      'SELECT * FROM scheduled_jobs WHERE id = $1',
      [id]
    );
    return res.rows[0] ?? null;
  }

  async findJobByIdempotencyKey(key: string): Promise<ScheduledJob | null> {
    const res = await this.pool.query<ScheduledJob>(
      'SELECT * FROM scheduled_jobs WHERE idempotency_key = $1',
      [key]
    );
    return res.rows[0] ?? null;
  }

  async createScheduledJob(
    job: Omit<ScheduledJob, 'id' | 'created_at' | 'attempts' | 'error_log'>
  ): Promise<ScheduledJob> {
    const res = await this.pool.query<ScheduledJob>(
      `
      INSERT INTO scheduled_jobs (
        instance_id, idempotency_key, contact_id, payload, scheduled_for, effective_send_at, status
      )
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
      RETURNING *
      `,
      [
        job.instance_id || env.INSTANCE_NAME,
        job.idempotency_key,
        job.contact_id,
        JSON.stringify(job.payload),
        job.scheduled_for,
        job.effective_send_at,
        job.status,
      ]
    );
    return res.rows[0];
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
    const fields: string[] = [];
    const values: unknown[] = [id];

    if (patch.scheduled_for !== undefined) {
      values.push(patch.scheduled_for);
      fields.push(`scheduled_for = $${values.length}`);
    }
    if (patch.effective_send_at !== undefined) {
      values.push(patch.effective_send_at);
      fields.push(`effective_send_at = $${values.length}`);
    }
    if (patch.status !== undefined) {
      values.push(patch.status);
      fields.push(`status = $${values.length}`);
    }
    if (patch.attempts !== undefined) {
      values.push(patch.attempts);
      fields.push(`attempts = $${values.length}`);
    }
    if (patch.error_log !== undefined) {
      values.push(patch.error_log);
      fields.push(`error_log = $${values.length}`);
    }

    if (!fields.length) return this.getScheduledJobById(id);

    const res = await this.pool.query<ScheduledJob>(
      `UPDATE scheduled_jobs SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    return res.rows[0] ?? null;
  }

  async listScheduledJobsByStatus(status: JobStatus): Promise<ScheduledJob[]> {
    const res = await this.pool.query<ScheduledJob>(
      'SELECT * FROM scheduled_jobs WHERE status = $1 ORDER BY effective_send_at ASC',
      [status]
    );
    return res.rows;
  }

  async getAIConfig(): Promise<AIConfig> {
    const res = await this.pool.query<AIConfig>(
      'SELECT * FROM ai_config WHERE id = 1'
    );
    if (res.rows[0]) {
      return res.rows[0];
    }

    const defaultPrompt =
      'Eres el asistente de atención y retención de Mejora Continua. Tu tono es empático, profesional, natural y humano. Respondes con brevedad para clarificar y contener sin usar frases robóticas ni avisos de transferencia.';
    const inserted = await this.pool.query<AIConfig>(
      `
      INSERT INTO ai_config (
        id, is_global_enabled, system_prompt, model_name, thinking_level,
        max_auto_turns, auto_mute_hours_on_human_reply, alert_webhook_url
      )
      VALUES (1, true, $1, $2, $3, 2, $4, $5)
      ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
      RETURNING *
      `,
      [
        defaultPrompt,
        env.AI_MODEL,
        env.AI_THINKING_LEVEL,
        env.AI_AUTO_MUTE_HOURS_ON_HUMAN_REPLY,
        env.OWNER_ALERT_WEBHOOK_URL || null,
      ]
    );
    return inserted.rows[0];
  }

  async recordAIUsage(
    log: Omit<AIUsageLogRecord, 'id' | 'created_at'>
  ): Promise<void> {
    await this.pool
      .query(
        `
        INSERT INTO ai_usage_logs (
          instance_id, contact_id, provider, model,
          prompt_tokens, thought_tokens, output_tokens, latency_ms, intent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          env.INSTANCE_NAME,
          log.contact_id,
          log.provider,
          log.model,
          log.prompt_tokens,
          log.thought_tokens,
          log.output_tokens,
          log.latency_ms,
          log.intent,
        ]
      )
      .catch(() => undefined);
  }
}

export class InMemoryWorkerStore implements IWorkerDataStore {
  private readonly contacts = new Map<string, Contact>();
  private readonly messages = new Map<string, Message>();
  private readonly jobs = new Map<string, ScheduledJob>();
  public readonly aiUsageLogs: AIUsageLogRecord[] = [];
  private aiConfig: AIConfig = {
    id: 1,
    is_global_enabled: true,
    system_prompt:
      'Eres el asistente de atención y retención de Mejora Continua. Tu tono es empático, profesional, natural y humano. Respondes con brevedad para clarificar y contener sin usar frases robóticas ni avisos de transferencia.',
    model_name: env.AI_MODEL,
    thinking_level: env.AI_THINKING_LEVEL,
    max_auto_turns: 2,
    handoff_keywords: [
      'precio',
      'comprar',
      'reunion',
      'reunión',
      'llamame',
      'llámame',
      'asesor',
      'info',
      'costo',
    ],
    auto_mute_hours_on_human_reply: env.AI_AUTO_MUTE_HOURS_ON_HUMAN_REPLY,
    alert_webhook_url: env.OWNER_ALERT_WEBHOOK_URL || null,
  };

  setAIConfig(patch: Partial<AIConfig>): AIConfig {
    this.aiConfig = { ...this.aiConfig, ...patch };
    return this.aiConfig;
  }

  async getContactById(id: string): Promise<Contact | null> {
    return this.contacts.get(id) ?? null;
  }

  async getContactByJid(jid: string): Promise<Contact | null> {
    for (const c of this.contacts.values()) {
      if (c.jid === jid) return c;
    }
    return null;
  }

  async upsertContact(
    data: Partial<Contact> & { jid: string; phone_number: string }
  ): Promise<Contact> {
    const existing = await this.getContactByJid(data.jid);
    if (existing) {
      const updated: Contact = {
        ...existing,
        phone_number: data.phone_number || existing.phone_number,
        push_name:
          data.push_name !== undefined ? data.push_name : existing.push_name,
        address_book_name:
          data.address_book_name !== undefined
            ? data.address_book_name
            : existing.address_book_name,
        is_in_broadcast:
          data.is_in_broadcast !== undefined
            ? data.is_in_broadcast
            : existing.is_in_broadcast,
        broadcast_lists: data.broadcast_lists ?? existing.broadcast_lists,
        ai_mode: data.ai_mode ?? existing.ai_mode,
        ai_muted_until:
          data.ai_muted_until !== undefined
            ? data.ai_muted_until
            : existing.ai_muted_until,
        is_whitelisted:
          data.is_whitelisted !== undefined
            ? data.is_whitelisted
            : existing.is_whitelisted,
        metadata: { ...existing.metadata, ...(data.metadata ?? {}) },
        last_interaction_at:
          data.last_interaction_at ?? existing.last_interaction_at,
      };
      this.contacts.set(updated.id, updated);
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
    return created;
  }

  async updateContactMode(
    contactId: string,
    aiMode: AIMode,
    mutedUntil: Date | null = null
  ): Promise<Contact | null> {
    const existing = this.contacts.get(contactId);
    if (!existing) return null;
    const updated: Contact = {
      ...existing,
      ai_mode: aiMode,
      ai_muted_until: mutedUntil,
    };
    this.contacts.set(contactId, updated);
    return updated;
  }

  async updateContactMetadata(
    contactId: string,
    metadataPatch: Record<string, unknown>
  ): Promise<Contact | null> {
    const existing = this.contacts.get(contactId);
    if (!existing) return null;
    const updated: Contact = {
      ...existing,
      metadata: { ...existing.metadata, ...metadataPatch },
    };
    this.contacts.set(contactId, updated);
    return updated;
  }

  async createMessage(
    msg: Omit<Message, 'id' | 'created_at'>
  ): Promise<Message> {
    for (const existing of this.messages.values()) {
      if (existing.whatsapp_message_id === msg.whatsapp_message_id) {
        const updated: Message = {
          ...existing,
          status: msg.status,
          body: msg.body,
        };
        this.messages.set(existing.id, updated);
        return updated;
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
        last_interaction_at: new Date(),
      });
    }

    return created;
  }

  async updatePendingJobMessage(
    jobId: string,
    whatsappMessageId: string,
    status: MessageStatus,
    renderedBody?: string
  ): Promise<void> {
    const pendingKey = `pending_${jobId}`;
    for (const [id, msg] of this.messages.entries()) {
      if (msg.whatsapp_message_id === pendingKey) {
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
    const list = Array.from(this.messages.values())
      .filter((m) => m.contact_id === contactId)
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    return list.slice(-limit);
  }

  async getScheduledJobById(id: string): Promise<ScheduledJob | null> {
    return this.jobs.get(id) ?? null;
  }

  async findJobByIdempotencyKey(key: string): Promise<ScheduledJob | null> {
    for (const job of this.jobs.values()) {
      if (job.idempotency_key === key) return job;
    }
    return null;
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
    return created;
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
    const existing = this.jobs.get(id);
    if (!existing) return null;
    const updated: ScheduledJob = {
      ...existing,
      ...patch,
    };
    this.jobs.set(id, updated);
    return updated;
  }

  async listScheduledJobsByStatus(status: JobStatus): Promise<ScheduledJob[]> {
    return Array.from(this.jobs.values())
      .filter((j) => j.status === status)
      .sort(
        (a, b) => a.effective_send_at.getTime() - b.effective_send_at.getTime()
      );
  }

  async getAIConfig(): Promise<AIConfig> {
    return { ...this.aiConfig };
  }

  async recordAIUsage(
    log: Omit<AIUsageLogRecord, 'id' | 'created_at'>
  ): Promise<void> {
    this.aiUsageLogs.push({
      ...log,
      id: randomUUID(),
      created_at: new Date(),
    });
  }
}
