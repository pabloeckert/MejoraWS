import pg from 'pg';
import type {
  AIConfig,
  AIMode,
  AIUsageLogRecord,
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

const { Pool } = pg;

export class PostgresDataStore implements IDataStore {
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
        broadcast_lists = CASE
          WHEN jsonb_array_length(EXCLUDED.broadcast_lists) > 0
          THEN EXCLUDED.broadcast_lists
          ELSE contacts.broadcast_lists
        END,
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

  async findContactByLid(lid: string): Promise<Contact | null> {
    const res = await this.pool.query<Contact>(
      `SELECT * FROM contacts 
       WHERE metadata->>'lid' = $1 
          OR jid = $1 
          OR metadata->>'remoteJidAlt' = $1
       LIMIT 1`,
      [lid]
    );
    return res.rows[0] ?? null;
  }

  async listContacts(filters?: ContactListFilters): Promise<Contact[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters?.isInBroadcast !== undefined) {
      params.push(filters.isInBroadcast);
      clauses.push(`is_in_broadcast = $${params.length}`);
    }
    if (filters?.aiMode) {
      params.push(filters.aiMode);
      clauses.push(`ai_mode = $${params.length}`);
    }
    if (filters?.search?.trim()) {
      params.push(`%${filters.search.trim()}%`);
      const idx = params.length;
      clauses.push(
        `(push_name ILIKE $${idx} OR address_book_name ILIKE $${idx} OR phone_number ILIKE $${idx} OR jid ILIKE $${idx})`
      );
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const res = await this.pool.query<Contact>(
      `SELECT * FROM contacts ${whereSql} ORDER BY COALESCE(last_interaction_at, created_at) DESC`,
      params
    );
    return res.rows;
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

  async updateContactWhitelist(
    contactId: string,
    isWhitelisted: boolean
  ): Promise<Contact | null> {
    const res = await this.pool.query<Contact>(
      `UPDATE contacts SET is_whitelisted = $2 WHERE id = $1 RETURNING *`,
      [contactId, isWhitelisted]
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
        body = CASE WHEN EXCLUDED.body IS NOT NULL AND EXCLUDED.body != '' THEN EXCLUDED.body ELSE messages.body END
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

  async updateMessageStatus(
    whatsappMessageId: string,
    status: MessageStatus
  ): Promise<void> {
    await this.pool.query(
      'UPDATE messages SET status = $2 WHERE whatsapp_message_id = $1',
      [whatsappMessageId, status]
    );
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

  async findJobByIdempotencyKey(key: string): Promise<ScheduledJob | null> {
    const res = await this.pool.query<ScheduledJob>(
      'SELECT * FROM scheduled_jobs WHERE idempotency_key = $1',
      [key]
    );
    return res.rows[0] ?? null;
  }

  async getScheduledJobById(id: string): Promise<ScheduledJob | null> {
    const res = await this.pool.query<ScheduledJob>(
      'SELECT * FROM scheduled_jobs WHERE id = $1',
      [id]
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

  async listScheduledJobs(status?: JobStatus): Promise<ScheduledJob[]> {
    if (status) {
      const res = await this.pool.query<ScheduledJob>(
        'SELECT * FROM scheduled_jobs WHERE status = $1 ORDER BY effective_send_at ASC',
        [status]
      );
      return res.rows;
    }
    const res = await this.pool.query<ScheduledJob>(
      'SELECT * FROM scheduled_jobs ORDER BY effective_send_at ASC'
    );
    return res.rows;
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

  async getAIConfig(): Promise<AIConfig> {
    const res = await this.pool.query<AIConfig>(
      'SELECT * FROM ai_config WHERE id = 1'
    );
    if (!res.rows[0]) {
      return {
        id: 1,
        is_global_enabled: true,
        system_prompt:
          'Eres el asistente de atención y retención de Mejora Continua. Tu tono es empático, profesional, natural y humano. Respondes con brevedad para clarificar y contener.',
        model_name: env.AI_MODEL || 'gemini-3.8-flash',
        thinking_level: env.AI_THINKING_LEVEL || 'high',
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
    }
    return {
      ...res.rows[0],
      thinking_level: res.rows[0].thinking_level || env.AI_THINKING_LEVEL || 'high',
    };
  }

  async updateAIConfig(patch: Partial<AIConfig>): Promise<AIConfig> {
    const current = await this.getAIConfig();
    const res = await this.pool.query<AIConfig>(
      `
      UPDATE ai_config SET
        is_global_enabled = $1,
        system_prompt = $2,
        model_name = $3,
        thinking_level = $4,
        max_auto_turns = $5,
        handoff_keywords = $6::jsonb,
        auto_mute_hours_on_human_reply = $7,
        alert_webhook_url = $8,
        updated_at = NOW()
      WHERE id = 1
      RETURNING *
      `,
      [
        patch.is_global_enabled ?? current.is_global_enabled,
        patch.system_prompt ?? current.system_prompt,
        patch.model_name ?? current.model_name,
        patch.thinking_level ?? current.thinking_level ?? 'high',
        patch.max_auto_turns ?? current.max_auto_turns,
        JSON.stringify(patch.handoff_keywords ?? current.handoff_keywords),
        patch.auto_mute_hours_on_human_reply ??
          current.auto_mute_hours_on_human_reply,
        patch.alert_webhook_url !== undefined
          ? patch.alert_webhook_url
          : current.alert_webhook_url,
      ]
    );
    return res.rows[0] ?? current;
  }

  async recordAIUsage(
    data: Omit<AIUsageLogRecord, 'id' | 'created_at'>
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO ai_usage_logs (
        contact_id, message_id, provider, model_name,
        prompt_tokens, completion_tokens, total_tokens,
        latency_ms, intent, confidence, raw_response
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        data.contact_id ?? null,
        data.message_id ?? null,
        data.provider,
        data.model_name ?? data.model,
        data.prompt_tokens,
        data.completion_tokens ?? data.output_tokens,
        data.total_tokens ??
          data.prompt_tokens + (data.completion_tokens ?? data.output_tokens),
        data.latency_ms,
        data.intent ?? null,
        data.confidence ?? null,
        data.raw_response ? JSON.stringify(data.raw_response) : null,
      ]
    );
  }

  async validateApiKeyHash(keyHash: string): Promise<boolean> {
    const res = await this.pool.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM api_keys WHERE key_hash = $1 AND is_active = true) AS exists',
      [keyHash]
    );
    return Boolean(res.rows[0]?.exists);
  }

  async listApiKeys(): Promise<ApiKey[]> {
    const res = await this.pool.query<ApiKey>(
      'SELECT id, label, key_hash, is_active, created_at FROM api_keys ORDER BY created_at DESC'
    );
    return res.rows;
  }

  async createApiKey(label: string, keyHash: string): Promise<ApiKey> {
    const res = await this.pool.query<ApiKey>(
      'INSERT INTO api_keys (label, key_hash) VALUES ($1, $2) RETURNING *',
      [label, keyHash]
    );
    return res.rows[0];
  }

  async getDailyMetrics(): Promise<DailyMetrics> {
    const msgRes = await this.pool.query<{
      sent_today: string;
      received_today: string;
      failed_today: string;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE direction = 'OUTBOUND' AND status IN ('SENT','DELIVERED','READ')) AS sent_today,
        COUNT(*) FILTER (WHERE direction = 'INBOUND') AS received_today,
        COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_today
      FROM messages
      WHERE created_at >= date_trunc('day', NOW())
    `);

    const jobRes = await this.pool.query<{ pending_jobs: string }>(`
      SELECT COUNT(*) AS pending_jobs
      FROM scheduled_jobs
      WHERE status IN ('PENDING', 'PROCESSING')
    `);

    const row = msgRes.rows[0];
    return {
      sentToday: Number(row?.sent_today || 0),
      receivedToday: Number(row?.received_today || 0),
      pendingJobs: Number(jobRes.rows[0]?.pending_jobs || 0),
      failedToday: Number(row?.failed_today || 0),
    };
  }
}
