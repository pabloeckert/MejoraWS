// src/campaigns/engine.ts
// Campaign Engine — crear, programar y ejecutar campañas

import Database, { Database as DatabaseType } from 'better-sqlite3'
import { generateId } from '../db/database'
import { generateVariation, selectVariation } from './templates'
import { WarmupManager } from '../antiban/warmup'
import { childLogger } from '../utils/logger'

const log = childLogger('campaigns:engine')

export interface Campaign {
  id: string
  name: string
  objective: string | null
  audience: string | null
  template: string
  variations: string[]
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed'
  scheduled_at: string | null
  sent_count: number
  delivered_count: number
  read_count: number
  reply_count: number
  created_at: string
  updated_at: string
}

export interface CampaignTarget {
  phone: string
  name?: string
  variables?: Record<string, string>
}

export class CampaignEngine {
  private db: DatabaseType
  private sendFn: (to: string, text: string, campaignId?: string) => Promise<boolean>
  private warmup: WarmupManager
  private runningCampaigns: Map<string, boolean> = new Map()

  constructor(
    db: DatabaseType,
    sendFn: (to: string, text: string, campaignId?: string) => Promise<boolean>,
    warmup: WarmupManager,
  ) {
    this.db = db
    this.sendFn = sendFn
    this.warmup = warmup
  }

  /**
   * Crea una nueva campaña
   */
  create(data: {
    name: string
    objective?: string
    audience?: string
    template: string
    variations?: string[]
    scheduled_at?: string
  }): Campaign {
    const id = generateId()
    const variations = JSON.stringify(data.variations || [])

    this.db.prepare(`
      INSERT INTO campaigns (id, name, objective, audience, template, variations, status, scheduled_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.objective || null,
      data.audience || null,
      data.template,
      variations,
      data.scheduled_at ? 'scheduled' : 'draft',
      data.scheduled_at || null,
    )

    log.info({ campaignId: id, name: data.name }, 'Campaign created')
    return this.get(id)!
  }

  /**
   * Obtiene una campaña por ID
   */
  get(id: string): Campaign | null {
    const row = this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as any
    if (!row) return null
    return {
      ...row,
      variations: row.variations ? JSON.parse(row.variations) : [],
    }
  }

  /**
   * Lista todas las campañas
   */
  list(limit: number = 50): Campaign[] {
    const rows = this.db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC LIMIT ?').all(limit) as any[]
    return rows.map(r => ({ ...r, variations: r.variations ? JSON.parse(r.variations) : [] }))
  }

  /**
   * Actualiza una campaña
   */
  update(id: string, data: Partial<Campaign>): Campaign | null {
    const fields: string[] = []
    const values: any[] = []

    if (data.name) { fields.push('name = ?'); values.push(data.name) }
    if (data.objective !== undefined) { fields.push('objective = ?'); values.push(data.objective) }
    if (data.template) { fields.push('template = ?'); values.push(data.template) }
    if (data.variations) { fields.push('variations = ?'); values.push(JSON.stringify(data.variations)) }
    if (data.status) { fields.push('status = ?'); values.push(data.status) }
    if (data.scheduled_at !== undefined) { fields.push('scheduled_at = ?'); values.push(data.scheduled_at) }

    if (fields.length === 0) return this.get(id)

    fields.push("updated_at = datetime('now')")
    values.push(id)

    this.db.prepare(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.get(id)
  }

  /**
   * Elimina una campaña
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM campaigns WHERE id = ?').run(id)
    return result.changes > 0
  }

  /**
   * Ejecuta una campaña contra una lista de targets
   */
  async execute(campaignId: string, targets: CampaignTarget[]): Promise<{
    sent: number
    failed: number
    skipped: number
  }> {
    const campaign = this.get(campaignId)
    if (!campaign) throw new Error('Campaign not found')

    this.runningCampaigns.set(campaignId, true)
    this.update(campaignId, { status: 'running' })

    let sent = 0
    let failed = 0
    let skipped = 0

    const allTemplates = [campaign.template, ...campaign.variations]

    log.info({ campaignId, targets: targets.length }, 'Campaign execution started')

    for (const target of targets) {
      // Check if campaign was paused/stopped
      if (!this.runningCampaigns.get(campaignId)) {
        log.info({ campaignId }, 'Campaign paused/stopped')
        break
      }

      // Check warm-up limits
      if (!this.warmup.canSend()) {
        log.warn({ campaignId }, 'Warm-up limit reached, pausing campaign')
        this.update(campaignId, { status: 'paused' })
        break
      }

      try {
        // Select template variation (anti-ban layer 6)
        const baseTemplate = selectVariation(allTemplates)

        // Generate unique variation (synonyms + format)
        const message = generateVariation(baseTemplate, target.variables)

        // Send
        const success = await this.sendFn(target.phone, message, campaignId)

        if (success) {
          sent++
          this.db.prepare(`
            UPDATE campaigns SET sent_count = sent_count + 1, updated_at = datetime('now') WHERE id = ?
          `).run(campaignId)
        } else {
          failed++
        }

        // Log progress every 10 messages
        if ((sent + failed) % 10 === 0) {
          log.info({ campaignId, sent, failed, skipped, total: targets.length }, 'Campaign progress')
        }
      } catch (err) {
        log.error({ err, phone: target.phone }, 'Failed to send campaign message')
        failed++
      }
    }

    // Update final status
    const finalStatus = this.runningCampaigns.get(campaignId) ? 'completed' : 'paused'
    this.update(campaignId, { status: finalStatus })
    this.runningCampaigns.delete(campaignId)

    log.info({ campaignId, sent, failed, skipped, status: finalStatus }, 'Campaign execution finished')

    return { sent, failed, skipped }
  }

  /**
   * Pausa una campaña en ejecución
   */
  pause(campaignId: string): void {
    this.runningCampaigns.set(campaignId, false)
    this.update(campaignId, { status: 'paused' })
    log.info({ campaignId }, 'Campaign paused')
  }

  /**
   * Registra una respuesta a una campaña
   */
  recordReply(campaignId: string): void {
    this.db.prepare(`
      UPDATE campaigns SET reply_count = reply_count + 1, updated_at = datetime('now') WHERE id = ?
    `).run(campaignId)
  }

  /**
   * Registra un mensaje delivered
   */
  recordDelivered(campaignId: string): void {
    this.db.prepare(`
      UPDATE campaigns SET delivered_count = delivered_count + 1, updated_at = datetime('now') WHERE id = ?
    `).run(campaignId)
  }

  /**
   * Registra un mensaje leído
   */
  recordRead(campaignId: string): void {
    this.db.prepare(`
      UPDATE campaigns SET read_count = read_count + 1, updated_at = datetime('now') WHERE id = ?
    `).run(campaignId)
  }

  /**
   * Obtiene estadísticas de una campaña
   */
  getStats(campaignId: string): {
    sent: number
    delivered: number
    read: number
    replied: number
    deliveryRate: number
    readRate: number
    replyRate: number
  } {
    const campaign = this.get(campaignId)
    if (!campaign) return { sent: 0, delivered: 0, read: 0, replied: 0, deliveryRate: 0, readRate: 0, replyRate: 0 }

    return {
      sent: campaign.sent_count,
      delivered: campaign.delivered_count,
      read: campaign.read_count,
      replied: campaign.reply_count,
      deliveryRate: campaign.sent_count > 0 ? Math.round((campaign.delivered_count / campaign.sent_count) * 100) : 0,
      readRate: campaign.delivered_count > 0 ? Math.round((campaign.read_count / campaign.delivered_count) * 100) : 0,
      replyRate: campaign.sent_count > 0 ? Math.round((campaign.reply_count / campaign.sent_count) * 100) : 0,
    }
  }

  /**
   * Obtiene campañas programadas que deben ejecutarse
   */
  getScheduledDue(): Campaign[] {
    const rows = this.db.prepare(`
      SELECT * FROM campaigns
      WHERE status = 'scheduled' AND scheduled_at <= datetime('now')
      ORDER BY scheduled_at ASC
    `).all() as any[]

    return rows.map(r => ({ ...r, variations: r.variations ? JSON.parse(r.variations) : [] }))
  }
}
