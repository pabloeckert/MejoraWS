// src/security/breach.ts
// GDPR Breach Notification Procedure (Art. 33/34)
// Registro, evaluación y notificación de brechas de datos

import Database, { Database as DatabaseType } from 'better-sqlite3'
import { generateId } from '../db/database'
import { childLogger } from '../utils/logger'

const log = childLogger('security:breach')

export type BreachSeverity = 'low' | 'medium' | 'high' | 'critical'
export type BreachStatus = 'detected' | 'investigating' | 'contained' | 'resolved' | 'reported'

export interface BreachIncident {
  id: string
  title: string
  description: string
  severity: BreachSeverity
  status: BreachStatus
  affected_records: number
  data_types: string // JSON array: ['phone', 'name', 'messages']
  detection_source: string
  detection_date: string
  containment_date: string | null
  resolution_date: string | null
  supervisor_notified: boolean
  authority_notified: boolean // GDPR Art. 33: 72h
  subjects_notified: boolean  // GDPR Art. 34: "without undue delay"
  authority_notification_date: string | null
  subjects_notification_date: string | null
  corrective_actions: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export class BreachManager {
  private db: DatabaseType

  constructor(db: DatabaseType) {
    this.db = db
    this.ensureTable()
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS breach_incidents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'detected',
        affected_records INTEGER DEFAULT 0,
        data_types TEXT DEFAULT '[]',
        detection_source TEXT,
        detection_date TEXT NOT NULL,
        containment_date TEXT,
        resolution_date TEXT,
        supervisor_notified INTEGER DEFAULT 0,
        authority_notified INTEGER DEFAULT 0,
        subjects_notified INTEGER DEFAULT 0,
        authority_notification_date TEXT,
        subjects_notification_date TEXT,
        corrective_actions TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_breach_status ON breach_incidents(status);
      CREATE INDEX IF NOT EXISTS idx_breach_severity ON breach_incidents(severity);
      CREATE INDEX IF NOT EXISTS idx_breach_detection ON breach_incidents(detection_date);
    `)
  }

  /**
   * Registra una nueva brecha de datos
   */
  report(data: {
    title: string
    description: string
    severity: BreachSeverity
    affected_records: number
    data_types: string[]
    detection_source: string
  }): BreachIncident {
    const id = generateId()
    const now = new Date().toISOString()

    this.db.prepare(`
      INSERT INTO breach_incidents (
        id, title, description, severity, status, affected_records,
        data_types, detection_source, detection_date
      ) VALUES (?, ?, ?, ?, 'detected', ?, ?, ?, ?)
    `).run(
      id, data.title, data.description, data.severity,
      data.affected_records, JSON.stringify(data.data_types),
      data.detection_source, now,
    )

    log.fatal({
      id, title: data.title, severity: data.severity,
      affected_records: data.affected_records,
    }, '🚨 BREACH DETECTED')

    return this.getById(id)!
  }

  /**
   * Actualiza el estado de una brecha
   */
  update(id: string, updates: Partial<{
    status: BreachStatus
    severity: BreachSeverity
    containment_date: string
    resolution_date: string
    supervisor_notified: boolean
    authority_notified: boolean
    subjects_notified: boolean
    authority_notification_date: string
    subjects_notification_date: string
    corrective_actions: string
    notes: string
  }>): void {
    const fields: string[] = []
    const values: any[] = []

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`)
        values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value)
      }
    }

    if (fields.length === 0) return

    fields.push("updated_at = datetime('now')")
    values.push(id)

    this.db.prepare(`UPDATE breach_incidents SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    log.info({ id, updates }, 'Breach incident updated')
  }

  /**
   * Marca como contenida
   */
  markContained(id: string): void {
    this.update(id, {
      status: 'contained',
      containment_date: new Date().toISOString(),
    })
  }

  /**
   * Marca como resuelta
   */
  markResolved(id: string, correctiveActions: string): void {
    this.update(id, {
      status: 'resolved',
      resolution_date: new Date().toISOString(),
      corrective_actions: correctiveActions,
    })
  }

  /**
   * Registra notificación a autoridad (GDPR Art. 33)
   * Obligatorio dentro de 72 horas de detectada la brecha
   */
  notifyAuthority(id: string): void {
    this.update(id, {
      authority_notified: true,
      authority_notification_date: new Date().toISOString(),
    })
    log.info({ id }, 'Authority notified (GDPR Art. 33)')
  }

  /**
   * Registra notificación a afectados (GDPR Art. 34)
   * Obligatorio "sin dilación indebida" cuando hay alto riesgo
   */
  notifySubjects(id: string): void {
    this.update(id, {
      subjects_notified: true,
      subjects_notification_date: new Date().toISOString(),
    })
    log.info({ id }, 'Data subjects notified (GDPR Art. 34)')
  }

  /**
   * Obtiene una brecha por ID
   */
  getById(id: string): BreachIncident | null {
    const row = this.db.prepare('SELECT * FROM breach_incidents WHERE id = ?').get(id) as any
    if (!row) return null
    return { ...row, data_types: JSON.parse(row.data_types || '[]') }
  }

  /**
   * Lista brechas con filtros
   */
  list(opts: {
    status?: BreachStatus
    severity?: BreachSeverity
    limit?: number
    offset?: number
  } = {}): BreachIncident[] {
    let query = 'SELECT * FROM breach_incidents WHERE 1=1'
    const params: any[] = []

    if (opts.status) {
      query += ' AND status = ?'
      params.push(opts.status)
    }
    if (opts.severity) {
      query += ' AND severity = ?'
      params.push(opts.severity)
    }

    query += ' ORDER BY detection_date DESC LIMIT ? OFFSET ?'
    params.push(opts.limit || 50, opts.offset || 0)

    const rows = this.db.prepare(query).all(...params) as any[]
    return rows.map(r => ({ ...r, data_types: JSON.parse(r.data_types || '[]') }))
  }

  /**
   * Estadísticas de brechas
   */
  getStats(): {
    total: number
    open: number
    resolved: number
    critical: number
    authorityPending: number
    avgResolutionHours: number | null
  } {
    const total = (this.db.prepare('SELECT COUNT(*) as c FROM breach_incidents').get() as any).c
    const open = (this.db.prepare("SELECT COUNT(*) as c FROM breach_incidents WHERE status NOT IN ('resolved')").get() as any).c
    const resolved = (this.db.prepare("SELECT COUNT(*) as c FROM breach_incidents WHERE status = 'resolved'").get() as any).c
    const critical = (this.db.prepare("SELECT COUNT(*) as c FROM breach_incidents WHERE severity = 'critical' AND status != 'resolved'").get() as any).c
    const authorityPending = (this.db.prepare("SELECT COUNT(*) as c FROM breach_incidents WHERE authority_notified = 0 AND status != 'resolved'").get() as any).c

    // Tiempo promedio de resolución
    const avgRow = this.db.prepare(`
      SELECT AVG((julianday(resolution_date) - julianday(detection_date)) * 24) as avg_hours
      FROM breach_incidents WHERE resolution_date IS NOT NULL
    `).get() as any

    return {
      total,
      open,
      resolved,
      critical,
      authorityPending,
      avgResolutionHours: avgRow?.avg_hours ? Math.round(avgRow.avg_hours) : null,
    }
  }

  /**
   * Verifica si hay brechas pendientes de notificación (>72h sin notificar)
   */
  getOverdueNotifications(): BreachIncident[] {
    const rows = this.db.prepare(`
      SELECT * FROM breach_incidents
      WHERE authority_notified = 0
        AND status != 'resolved'
        AND julianday('now') - julianday(detection_date) > 3
      ORDER BY detection_date ASC
    `).all() as any[]

    return rows.map(r => ({ ...r, data_types: JSON.parse(r.data_types || '[]') }))
  }
}
