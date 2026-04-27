// src/api/routes/gdpr.ts
// GDPR compliance endpoints — export, delete, consent management

import { Router, Request, Response } from 'express'
import Database, { Database as DatabaseType } from 'better-sqlite3'
import { AuditLogger } from '../../security/audit'
import { AppError } from '../middleware/error'
import { childLogger } from '../../utils/logger'

const log = childLogger('api:gdpr')

export function gdprRouter(db: DatabaseType, audit: AuditLogger) {
  const router = Router()

  /**
   * GET /api/v1/gdpr/export/:phone
   * Exporta todos los datos de un contacto (GDPR Right of Access)
   */
  router.get('/export/:phone', (req: Request, res: Response) => {
    const phone = req.params.phone as string

    // Get contact
    const contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get(phone) as any
    if (!contact) throw new AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND')

    // Get messages
    const messages = db.prepare(`
      SELECT id, direction, content, status, created_at
      FROM messages WHERE contact_phone = ?
      ORDER BY created_at ASC
    `).all(phone)

    // Get deals
    const deals = db.prepare(`
      SELECT id, stage, value, probability, notes, created_at, updated_at
      FROM deals WHERE contact_phone = ?
    `).all(phone)

    // Get activities
    const activities = db.prepare(`
      SELECT id, type, description, created_at
      FROM activities WHERE contact_phone = ?
      ORDER BY created_at ASC
    `).all(phone)

    const exportData = {
      exportDate: new Date().toISOString(),
      contact: {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        company: contact.company,
        tags: contact.tags ? JSON.parse(contact.tags) : [],
        score: contact.score,
        consent: !!contact.consent,
        source: contact.source,
        created_at: contact.created_at,
        updated_at: contact.updated_at,
      },
      messages: messages.map((m: any) => ({
        direction: m.direction,
        content: m.content,
        status: m.status,
        date: m.created_at,
      })),
      deals,
      activities,
      totalMessages: messages.length,
      totalDeals: deals.length,
    }

    audit.log({
      action: 'gdpr.export',
      entity_type: 'contact',
      entity_id: phone,
      ip: req.ip,
    })

    log.info({ phone }, 'GDPR data export')

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${phone}.json"`)
    res.json(exportData)
  })

  /**
   * DELETE /api/v1/gdpr/erase/:phone
   * Borra todos los datos de un contacto (GDPR Right to Erasure)
   */
  router.delete('/erase/:phone', (req: Request, res: Response) => {
    const phone = req.params.phone as string

    // Verify contact exists
    const contact = db.prepare('SELECT id FROM contacts WHERE phone = ?').get(phone)
    if (!contact) throw new AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND')

    // Delete in transaction
    const erase = db.transaction(() => {
      const messagesDeleted = db.prepare('DELETE FROM messages WHERE contact_phone = ?').run(phone).changes
      const activitiesDeleted = db.prepare('DELETE FROM activities WHERE contact_phone = ?').run(phone).changes
      const dealsDeleted = db.prepare('DELETE FROM deals WHERE contact_phone = ?').run(phone).changes
      const contactDeleted = db.prepare('DELETE FROM contacts WHERE phone = ?').run(phone).changes

      return { messagesDeleted, activitiesDeleted, dealsDeleted, contactDeleted }
    })

    const result = erase()

    audit.log({
      action: 'gdpr.delete',
      entity_type: 'contact',
      entity_id: phone,
      details: JSON.stringify(result),
      ip: req.ip,
    })

    log.info({ phone, ...result }, 'GDPR data erasure completed')

    res.json({
      data: {
        message: 'All data erased for this contact',
        phone,
        ...result,
      },
    })
  })

  /**
   * PUT /api/v1/gdpr/consent/:phone
   * Actualiza el consentimiento de un contacto
   */
  router.put('/consent/:phone', (req: Request, res: Response) => {
    const phone = req.params.phone as string
    const { consent } = req.body

    if (typeof consent !== 'boolean') {
      throw new AppError(400, 'consent must be boolean', 'INVALID_CONSENT')
    }

    const result = db.prepare(`
      UPDATE contacts SET consent = ?, updated_at = datetime('now') WHERE phone = ?
    `).run(consent ? 1 : 0, phone)

    if (result.changes === 0) throw new AppError(404, 'Contact not found', 'CONTACT_NOT_FOUND')

    audit.log({
      action: 'gdpr.consent',
      entity_type: 'contact',
      entity_id: phone,
      details: `consent=${consent}`,
      ip: req.ip,
    })

    log.info({ phone, consent }, 'Consent updated')

    res.json({ data: { phone, consent, updated: true } })
  })

  /**
   * GET /api/v1/gdpr/stats
   * Estadísticas de compliance
   */
  router.get('/stats', (_req: Request, res: Response) => {
    const totalContacts = (db.prepare('SELECT COUNT(*) as c FROM contacts').get() as any).c
    const withConsent = (db.prepare('SELECT COUNT(*) as c FROM contacts WHERE consent = 1').get() as any).c
    const withoutConsent = totalContacts - withConsent
    const totalMessages = (db.prepare('SELECT COUNT(*) as c FROM messages').get() as any).c
    const totalActivities = (db.prepare('SELECT COUNT(*) as c FROM activities').get() as any).c

    const oldestMessage = db.prepare('SELECT MIN(created_at) as d FROM messages').get() as any
    const newestMessage = db.prepare('SELECT MAX(created_at) as d FROM messages').get() as any

    res.json({
      data: {
        contacts: { total: totalContacts, withConsent, withoutConsent },
        messages: { total: totalMessages, oldest: oldestMessage?.d, newest: newestMessage?.d },
        activities: { total: totalActivities },
        auditLog: { total: audit.count() },
      },
    })
  })

  return router
}
