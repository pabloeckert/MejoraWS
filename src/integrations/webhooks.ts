// src/integrations/webhooks.ts
// Webhook system — sends HTTP callbacks to registered URLs on events

import { childLogger } from '../utils/logger'
import Database, { Database as DatabaseType } from 'better-sqlite3'
import { generateId } from '../db/database'

const log = childLogger('webhooks')

export type WebhookEvent =
  | 'message.received'
  | 'message.sent'
  | 'contact.created'
  | 'contact.updated'
  | 'deal.created'
  | 'deal.stage_changed'
  | 'deal.closed'
  | 'campaign.completed'
  | 'bot.escalated'

export interface Webhook {
  id: string
  url: string
  events: WebhookEvent[]
  active: boolean
  secret: string | null
  created_at: string
  last_triggered_at: string | null
  failure_count: number
}

interface WebhookDelivery {
  id: string
  webhook_id: string
  event: WebhookEvent
  payload: string
  status: 'pending' | 'delivered' | 'failed'
  response_code: number | null
  error: string | null
  created_at: string
}

export class WebhookManager {
  private db: DatabaseType

  constructor(db: DatabaseType) {
    this.db = db
    this.ensureTables()
  }

  private ensureTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        events TEXT NOT NULL DEFAULT '[]',
        active INTEGER DEFAULT 1,
        secret TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        last_triggered_at TEXT,
        failure_count INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id TEXT PRIMARY KEY,
        webhook_id TEXT NOT NULL,
        event TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        response_code INTEGER,
        error TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created ON webhook_deliveries(created_at);
    `)
  }

  /**
   * Register a new webhook
   */
  create(url: string, events: WebhookEvent[], secret?: string): Webhook {
    const id = generateId()
    this.db.prepare(`
      INSERT INTO webhooks (id, url, events, secret) VALUES (?, ?, ?, ?)
    `).run(id, url, JSON.stringify(events), secret || null)
    return this.get(id)!
  }

  /**
   * Get a webhook by ID
   */
  get(id: string): Webhook | null {
    const row = this.db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id) as any
    if (!row) return null
    return { ...row, events: JSON.parse(row.events), active: !!row.active }
  }

  /**
   * List all webhooks
   */
  list(): Webhook[] {
    const rows = this.db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all() as any[]
    return rows.map(r => ({ ...r, events: JSON.parse(r.events), active: !!r.active }))
  }

  /**
   * Update a webhook
   */
  update(id: string, data: { url?: string; events?: WebhookEvent[]; active?: boolean; secret?: string }): Webhook | null {
    const fields: string[] = []
    const values: any[] = []
    if (data.url) { fields.push('url = ?'); values.push(data.url) }
    if (data.events) { fields.push('events = ?'); values.push(JSON.stringify(data.events)) }
    if (data.active !== undefined) { fields.push('active = ?'); values.push(data.active ? 1 : 0) }
    if (data.secret !== undefined) { fields.push('secret = ?'); values.push(data.secret) }
    if (fields.length === 0) return this.get(id)
    values.push(id)
    this.db.prepare(`UPDATE webhooks SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.get(id)
  }

  /**
   * Delete a webhook
   */
  delete(id: string): boolean {
    this.db.prepare('DELETE FROM webhook_deliveries WHERE webhook_id = ?').run(id)
    const result = this.db.prepare('DELETE FROM webhooks WHERE id = ?').run(id)
    return result.changes > 0
  }

  /**
   * Trigger webhooks for an event
   */
  async trigger(event: WebhookEvent, data: any): Promise<void> {
    const webhooks = this.list().filter(w => w.active && w.events.includes(event))
    if (webhooks.length === 0) return

    const payload = JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
    })

    for (const webhook of webhooks) {
      const deliveryId = generateId()
      this.db.prepare(`
        INSERT INTO webhook_deliveries (id, webhook_id, event, payload) VALUES (?, ?, ?, ?)
      `).run(deliveryId, webhook.id, event, payload)

      // Fire and forget (don't block the main flow)
      this.deliver(webhook, deliveryId, payload).catch(err => {
        log.error({ err, webhookId: webhook.id }, 'Webhook delivery failed')
      })
    }
  }

  /**
   * Deliver a webhook payload
   */
  private async deliver(webhook: Webhook, deliveryId: string, payload: string): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-MejoraWS-Event': payload ? JSON.parse(payload).event : 'unknown',
        'X-MejoraWS-Delivery': deliveryId,
      }

      // HMAC signature if secret is set
      if (webhook.secret) {
        const crypto = await import('crypto')
        const signature = crypto.createHmac('sha256', webhook.secret).update(payload).digest('hex')
        headers['X-MejoraWS-Signature'] = `sha256=${signature}`
      }

      const res = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(10_000), // 10s timeout
      })

      const status = res.ok ? 'delivered' : 'failed'
      this.db.prepare(`
        UPDATE webhook_deliveries SET status = ?, response_code = ? WHERE id = ?
      `).run(status, res.status, deliveryId)

      if (res.ok) {
        this.db.prepare('UPDATE webhooks SET last_triggered_at = datetime(\'now\'), failure_count = 0 WHERE id = ?')
          .run(webhook.id)
      } else {
        this.db.prepare('UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?')
          .run(webhook.id)
      }

      log.info({ webhookId: webhook.id, event: JSON.parse(payload).event, status: res.status }, 'Webhook delivered')
    } catch (err: any) {
      this.db.prepare(`
        UPDATE webhook_deliveries SET status = 'failed', error = ? WHERE id = ?
      `).run(err.message, deliveryId)
      this.db.prepare('UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?')
        .run(webhook.id)
      log.error({ err, webhookId: webhook.id }, 'Webhook delivery error')
    }
  }

  /**
   * Get delivery history for a webhook
   */
  getDeliveries(webhookId: string, limit: number = 20): WebhookDelivery[] {
    return this.db.prepare(`
      SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(webhookId, limit) as WebhookDelivery[]
  }

  /**
   * Retry failed deliveries
   */
  async retryFailed(): Promise<number> {
    const failed = this.db.prepare(`
      SELECT wd.*, w.url, w.secret
      FROM webhook_deliveries wd
      JOIN webhooks w ON wd.webhook_id = w.id
      WHERE wd.status = 'failed' AND w.active = 1
      ORDER BY wd.created_at ASC
      LIMIT 10
    `).all() as any[]

    let retried = 0
    for (const delivery of failed) {
      const webhook = this.get(delivery.webhook_id)
      if (webhook) {
        await this.deliver(webhook, delivery.id, delivery.payload)
        retried++
      }
    }
    return retried
  }
}
