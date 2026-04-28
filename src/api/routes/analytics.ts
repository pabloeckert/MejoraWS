// src/api/routes/analytics.ts
// Analytics endpoints — KPIs, funnel, sentiment, timing, quality

import { Router, Request, Response } from 'express'
import Database from 'better-sqlite3'
import { childLogger } from '../../utils/logger'

const log = childLogger('api:analytics')

export function analyticsRouter(db: Database.Database) {
  const router = Router()

  // === GET /api/v1/analytics/overview ===
  // KPIs principales: mensajes, contactos, deals, revenue
  router.get('/overview', (_req: Request, res: Response) => {
    try {
      const today = new Date().toISOString().split('T')[0]

      // Mensajes hoy
      const messagesToday = db.prepare(
        `SELECT COUNT(*) as count FROM messages WHERE DATE(created_at) = ?`
      ).get(today) as any

      // Mensajes esta semana
      const messagesWeek = db.prepare(
        `SELECT COUNT(*) as count FROM messages WHERE created_at >= datetime('now', '-7 days')`
      ).get() as any

      // Mensajes este mes
      const messagesMonth = db.prepare(
        `SELECT COUNT(*) as count FROM messages WHERE created_at >= datetime('now', '-30 days')`
      ).get() as any

      // Tasa de respuesta del bot (outbound / inbound)
      const inbound = db.prepare(
        `SELECT COUNT(*) as count FROM messages WHERE direction = 'inbound' AND created_at >= datetime('now', '-30 days')`
      ).get() as any
      const outbound = db.prepare(
        `SELECT COUNT(*) as count FROM messages WHERE direction = 'outbound' AND created_at >= datetime('now', '-30 days')`
      ).get() as any
      const responseRate = inbound.count > 0
        ? Math.round((outbound.count / inbound.count) * 100)
        : 0

      // Deals
      const dealsCreated = db.prepare(
        `SELECT COUNT(*) as count FROM deals WHERE created_at >= datetime('now', '-30 days')`
      ).get() as any
      const dealsClosed = db.prepare(
        `SELECT COUNT(*) as count FROM deals WHERE stage LIKE 'cerrado-%' AND updated_at >= datetime('now', '-30 days')`
      ).get() as any
      const dealsWon = db.prepare(
        `SELECT COUNT(*) as count FROM deals WHERE stage = 'cerrado-ganado' AND updated_at >= datetime('now', '-30 days')`
      ).get() as any
      const revenue = db.prepare(
        `SELECT COALESCE(SUM(value), 0) as total FROM deals WHERE stage = 'cerrado-ganado' AND updated_at >= datetime('now', '-30 days')`
      ).get() as any

      const conversionRate = dealsCreated.count > 0
        ? Math.round((dealsWon.count / dealsCreated.count) * 100)
        : 0

      res.json({
        data: {
          messages: {
            today: messagesToday.count,
            week: messagesWeek.count,
            month: messagesMonth.count,
          },
          responseRate,
          deals: {
            created: dealsCreated.count,
            closed: dealsClosed.count,
            won: dealsWon.count,
            conversionRate,
          },
          revenue: revenue.total,
        },
      })
    } catch (err: any) {
      log.error({ err }, 'Error getting analytics overview')
      res.status(500).json({ error: err.message })
    }
  })

  // === GET /api/v1/analytics/messages ===
  // Tendencia de mensajes por día (últimos 30 días)
  router.get('/messages', (_req: Request, res: Response) => {
    try {
      const rows = db.prepare(`
        SELECT
          DATE(created_at) as date,
          SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound,
          SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound,
          COUNT(*) as total
        FROM messages
        WHERE created_at >= datetime('now', '-30 days')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `).all()

      res.json({ data: rows })
    } catch (err: any) {
      log.error({ err }, 'Error getting message trends')
      res.status(500).json({ error: err.message })
    }
  })

  // === GET /api/v1/analytics/funnel ===
  // Conversion funnel: contactos → mensajes → deals → cerrados
  router.get('/funnel', (_req: Request, res: Response) => {
    try {
      const contacts = db.prepare(`SELECT COUNT(*) as count FROM contacts`).get() as any
      const withMessages = db.prepare(`
        SELECT COUNT(DISTINCT contact_phone) as count FROM messages
      `).get() as any
      const withDeals = db.prepare(`
        SELECT COUNT(DISTINCT contact_phone) as count FROM deals
      `).get() as any
      const closedWon = db.prepare(`
        SELECT COUNT(*) as count FROM deals WHERE stage = 'cerrado-ganado'
      `).get() as any

      const funnel = [
        { stage: 'Contactos', count: contacts.count, rate: 100 },
        {
          stage: 'Con Mensajes',
          count: withMessages.count,
          rate: contacts.count > 0 ? Math.round((withMessages.count / contacts.count) * 100) : 0,
        },
        {
          stage: 'Con Deals',
          count: withDeals.count,
          rate: contacts.count > 0 ? Math.round((withDeals.count / contacts.count) * 100) : 0,
        },
        {
          stage: 'Cerrados Ganados',
          count: closedWon.count,
          rate: contacts.count > 0 ? Math.round((closedWon.count / contacts.count) * 100) : 0,
        },
      ]

      res.json({ data: funnel })
    } catch (err: any) {
      log.error({ err }, 'Error getting funnel')
      res.status(500).json({ error: err.message })
    }
  })

  // === GET /api/v1/analytics/sentiment ===
  // Sentiment trend (from activities metadata)
  router.get('/sentiment', (_req: Request, res: Response) => {
    try {
      // Get sentiment from activity metadata (where type = 'auto-reply')
      const rows = db.prepare(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as total,
          SUM(CASE WHEN metadata LIKE '%"sentiment":"positivo"%' THEN 1 ELSE 0 END) as positive,
          SUM(CASE WHEN metadata LIKE '%"sentiment":"neutro"%' THEN 1 ELSE 0 END) as neutral,
          SUM(CASE WHEN metadata LIKE '%"sentiment":"negativo"%' THEN 1 ELSE 0 END) as negative
        FROM activities
        WHERE type = 'auto-reply'
          AND created_at >= datetime('now', '-30 days')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `).all()

      // Calculate sentiment score per day (-1 to 1)
      const data = (rows as any[]).map(r => ({
        date: r.date,
        total: r.total,
        positive: r.positive,
        neutral: r.neutral,
        negative: r.negative,
        score: r.total > 0
          ? Math.round(((r.positive - r.negative) / r.total) * 100) / 100
          : 0,
      }))

      res.json({ data })
    } catch (err: any) {
      log.error({ err }, 'Error getting sentiment')
      res.status(500).json({ error: err.message })
    }
  })

  // === GET /api/v1/analytics/timing ===
  // Best times to send messages (hour distribution of replies received)
  router.get('/timing', (_req: Request, res: Response) => {
    try {
      // Hour distribution of inbound messages (when users reply)
      const hourly = db.prepare(`
        SELECT
          CAST(strftime('%H', created_at) AS INTEGER) as hour,
          COUNT(*) as count
        FROM messages
        WHERE direction = 'inbound'
          AND created_at >= datetime('now', '-30 days')
        GROUP BY hour
        ORDER BY hour ASC
      `).all()

      // Day of week distribution
      const daily = db.prepare(`
        SELECT
          CASE CAST(strftime('%w', created_at) AS INTEGER)
            WHEN 0 THEN 'Dom'
            WHEN 1 THEN 'Lun'
            WHEN 2 THEN 'Mar'
            WHEN 3 THEN 'Mié'
            WHEN 4 THEN 'Jue'
            WHEN 5 THEN 'Vie'
            WHEN 6 THEN 'Sáb'
          END as day,
          CAST(strftime('%w', created_at) AS INTEGER) as dayNum,
          COUNT(*) as count
        FROM messages
        WHERE direction = 'inbound'
          AND created_at >= datetime('now', '-30 days')
        GROUP BY dayNum
        ORDER BY dayNum ASC
      `).all()

      // Find best hour and day
      const bestHour = (hourly as any[]).reduce(
        (best, r) => (r.count > (best?.count || 0) ? r : best),
        null,
      )
      const bestDay = (daily as any[]).reduce(
        (best, r) => (r.count > (best?.count || 0) ? r : best),
        null,
      )

      res.json({
        data: {
          hourly,
          daily,
          bestHour: bestHour?.hour ?? null,
          bestDay: bestDay?.day ?? null,
        },
      })
    } catch (err: any) {
      log.error({ err }, 'Error getting timing')
      res.status(500).json({ error: err.message })
    }
  })

  // === GET /api/v1/analytics/quality ===
  // Conversation quality scoring
  router.get('/quality', (_req: Request, res: Response) => {
    try {
      // Average messages per conversation
      const avgMsgs = db.prepare(`
        SELECT
          contact_phone,
          COUNT(*) as msg_count
        FROM messages
        GROUP BY contact_phone
      `).all()

      const totalConversations = (avgMsgs as any[]).length
      const avgMessagesPerConv = totalConversations > 0
        ? Math.round((avgMsgs as any[]).reduce((sum, r) => sum + r.msg_count, 0) / totalConversations)
        : 0

      // Conversations with escalation (keywords in activities)
      const escalations = db.prepare(`
        SELECT COUNT(DISTINCT contact_phone) as count
        FROM activities
        WHERE type = 'escalation'
          AND created_at >= datetime('now', '-30 days')
      `).get() as any

      // Auto-reply success (messages with outbound that didn't escalate)
      const autoReplied = db.prepare(`
        SELECT COUNT(DISTINCT m.contact_phone) as count
        FROM messages m
        WHERE m.direction = 'outbound'
          AND m.contact_phone NOT IN (
            SELECT DISTINCT contact_phone FROM activities WHERE type = 'escalation'
          )
      `).get() as any

      const autoResolutionRate = totalConversations > 0
        ? Math.round((autoReplied.count / totalConversations) * 100)
        : 0

      // Intent distribution
      const intents = db.prepare(`
        SELECT
          COALESCE(
            json_extract(metadata, '$.intent'),
            'UNKNOWN'
          ) as intent,
          COUNT(*) as count
        FROM activities
        WHERE type = 'auto-reply'
          AND created_at >= datetime('now', '-30 days')
        GROUP BY intent
        ORDER BY count DESC
        LIMIT 10
      `).all()

      res.json({
        data: {
          totalConversations,
          avgMessagesPerConv,
          escalationRate: totalConversations > 0
            ? Math.round((escalations.count / totalConversations) * 100)
            : 0,
          autoResolutionRate,
          intents,
        },
      })
    } catch (err: any) {
      log.error({ err }, 'Error getting quality')
      res.status(500).json({ error: err.message })
    }
  })

  // === GET /api/v1/analytics/export ===
  // Export analytics data as CSV
  router.get('/export', (req: Request, res: Response) => {
    try {
      const type = (req.query.type as string) || 'messages'
      const days = parseInt(req.query.days as string) || 30

      let rows: any[] = []
      let filename = ''

      switch (type) {
        case 'messages':
          rows = db.prepare(`
            SELECT
              DATE(created_at) as date,
              contact_phone,
              direction,
              content,
              status,
              created_at
            FROM messages
            WHERE created_at >= datetime('now', '-${days} days')
            ORDER BY created_at DESC
          `).all()
          filename = 'messages'
          break

        case 'contacts':
          rows = db.prepare(`
            SELECT
              name, phone, email, company, whatsapp,
              tags, score, source, consent, created_at
            FROM contacts
            ORDER BY created_at DESC
          `).all()
          filename = 'contacts'
          break

        case 'deals':
          rows = db.prepare(`
            SELECT
              d.contact_phone,
              c.name as contact_name,
              d.stage,
              d.value,
              d.probability,
              d.notes,
              d.next_follow_up,
              d.created_at,
              d.updated_at
            FROM deals d
            LEFT JOIN contacts c ON c.phone = d.contact_phone
            ORDER BY d.created_at DESC
          `).all()
          filename = 'deals'
          break

        case 'campaigns':
          rows = db.prepare(`
            SELECT
              name, status, audience,
              sent_count, delivered_count, read_count, reply_count,
              scheduled_at, created_at
            FROM campaigns
            ORDER BY created_at DESC
          `).all()
          filename = 'campaigns'
          break

        default:
          return res.status(400).json({ error: 'Invalid export type. Use: messages, contacts, deals, campaigns' })
      }

      if (rows.length === 0) {
        return res.json({ data: [], message: 'No data to export' })
      }

      // Build CSV
      const headers = Object.keys(rows[0])
      const csv = [
        headers.join(','),
        ...rows.map(row =>
          headers.map(h => {
            const val = row[h]
            if (val === null || val === undefined) return ''
            const str = String(val)
            // Escape commas and quotes
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`
            }
            return str
          }).join(',')
        ),
      ].join('\n')

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="mejoraws-${filename}-${new Date().toISOString().split('T')[0]}.csv"`)
      res.send(csv)
    } catch (err: any) {
      log.error({ err }, 'Error exporting')
      res.status(500).json({ error: err.message })
    }
  })

  log.info('Analytics routes initialized')
  return router
}
