// src/campaigns/scheduler.ts
// Campaign Scheduler — ejecuta campañas programadas automáticamente

import { CampaignEngine } from './engine'
import { ContactManager } from '../crm/contacts'
import { childLogger } from '../utils/logger'

const log = childLogger('campaigns:scheduler')

export class CampaignScheduler {
  private engine: CampaignEngine
  private contacts: ContactManager
  private intervalId: ReturnType<typeof setInterval> | null = null
  private checkIntervalMs: number

  constructor(engine: CampaignEngine, contacts: ContactManager, checkIntervalMs: number = 60_000) {
    this.engine = engine
    this.contacts = contacts
    this.checkIntervalMs = checkIntervalMs
  }

  /**
   * Inicia el scheduler que revisa campañas programadas
   */
  start(): void {
    if (this.intervalId) return

    this.intervalId = setInterval(() => {
      this.checkAndExecute()
    }, this.checkIntervalMs)

    log.info({ intervalMs: this.checkIntervalMs }, 'Campaign scheduler started')
  }

  /**
   * Detiene el scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    log.info('Campaign scheduler stopped')
  }

  /**
   * Revisa y ejecuta campañas programadas que vencieron
   */
  async checkAndExecute(): Promise<void> {
    const due = this.engine.getScheduledDue()

    for (const campaign of due) {
      log.info({ campaignId: campaign.id, name: campaign.name }, 'Executing scheduled campaign')

      try {
        // Get target audience
        const targets = this.resolveAudience(campaign.audience)

        if (targets.length === 0) {
          log.warn({ campaignId: campaign.id }, 'No targets for campaign, marking as completed')
          this.engine.update(campaign.id, { status: 'completed' })
          continue
        }

        // Execute campaign
        await this.engine.execute(campaign.id, targets)
      } catch (err) {
        log.error({ err, campaignId: campaign.id }, 'Failed to execute scheduled campaign')
      }
    }
  }

  /**
   * Resuelve la audiencia de una campaña
   * Formato del audience string:
   *   - "all" → todos los contactos con WhatsApp
   *   - "tag:ventas" → contactos con tag "ventas"
   *   - "score:50+" → contactos con score >= 50
   *   - "phone:54911...,54911..." → lista de teléfonos
   */
  resolveAudience(audience: string | null): Array<{ phone: string; name?: string; variables?: Record<string, string> }> {
    if (!audience || audience === 'all') {
      return this.contacts.getWithWhatsApp(500).map(c => ({
        phone: c.phone,
        name: c.name || undefined,
        variables: { nombre: c.name || '', empresa: c.company || '' },
      }))
    }

    if (audience.startsWith('tag:')) {
      const tag = audience.slice(4)
      return this.contacts.getByTag(tag)
        .filter(c => c.whatsapp)
        .map(c => ({
          phone: c.phone,
          name: c.name || undefined,
          variables: { nombre: c.name || '', empresa: c.company || '' },
        }))
    }

    if (audience.startsWith('score:')) {
      const minScore = parseInt(audience.slice(6))
      return this.contacts.list({ minScore, whatsapp: true })
        .map(c => ({
          phone: c.phone,
          name: c.name || undefined,
          variables: { nombre: c.name || '', empresa: c.company || '' },
        }))
    }

    if (audience.startsWith('phone:')) {
      const phones = audience.slice(6).split(',').map(p => p.trim())
      return phones.map(phone => ({ phone }))
    }

    log.warn({ audience }, 'Unknown audience format, returning empty')
    return []
  }
}
