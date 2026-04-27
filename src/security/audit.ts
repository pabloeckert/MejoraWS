// src/security/audit.ts
// Audit log — trazabilidad de acciones sensibles

import Database, { Database as DatabaseType } from 'better-sqlite3'
import { generateId } from '../db/database'
import { childLogger } from '../utils/logger'

const log = childLogger('security:audit')

export type AuditAction =
  | 'contact.create'
  | 'contact.update'
  | 'contact.delete'
  | 'contact.export'
  | 'deal.create'
  | 'deal.move'
  | 'deal.close'
  | 'campaign.create'
  | 'campaign.execute'
  | 'campaign.pause'
  | 'campaign.delete'
  | 'message.send'
  | 'message.import'
  | 'config.update'
  | 'kb.update'
  | 'gdpr.export'
  | 'gdpr.delete'
  | 'gdpr.consent'
  | 'auth.login'
  | 'auth.failed'

export interface AuditEntry {
  id: string
  action: AuditAction
  entity_type?: string
  entity_id?: string
  details?: string
  ip?: string
  user_agent?: string
  created_at: string
}

export class AuditLogger {
  private db: DatabaseType

  constructor(db: DatabaseType) {
    this.db = db
    this.ensureTable()
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        details TEXT,
        ip TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
    `)
  }

  /**
   * Registra una acción en el audit log
   */
  log(data: {
    action: AuditAction
    entity_type?: string
    entity_id?: string
    details?: string
    ip?: string
    user_agent?: string
  }): void {
    try {
      this.db.prepare(`
        INSERT INTO audit_log (id, action, entity_type, entity_id, details, ip, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId(),
        data.action,
        data.entity_type || null,
        data.entity_id || null,
        data.details || null,
        data.ip || null,
        data.user_agent || null,
      )
    } catch (err) {
      log.error({ err }, 'Failed to write audit log')
    }
  }

  /**
   * Obtiene entradas del audit log con filtros
   */
  getEntries(opts: {
    action?: AuditAction
    entity_type?: string
    entity_id?: string
    limit?: number
    offset?: number
    from?: string
    to?: string
  } = {}): AuditEntry[] {
    let query = 'SELECT * FROM audit_log WHERE 1=1'
    const params: any[] = []

    if (opts.action) {
      query += ' AND action = ?'
      params.push(opts.action)
    }
    if (opts.entity_type) {
      query += ' AND entity_type = ?'
      params.push(opts.entity_type)
    }
    if (opts.entity_id) {
      query += ' AND entity_id = ?'
      params.push(opts.entity_id)
    }
    if (opts.from) {
      query += ' AND created_at >= ?'
      params.push(opts.from)
    }
    if (opts.to) {
      query += ' AND created_at <= ?'
      params.push(opts.to)
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(opts.limit || 100, opts.offset || 0)

    return this.db.prepare(query).all(...params) as AuditEntry[]
  }

  /**
   * Cuenta entradas
   */
  count(opts: { action?: AuditAction } = {}): number {
    let query = 'SELECT COUNT(*) as c FROM audit_log WHERE 1=1'
    const params: any[] = []
    if (opts.action) {
      query += ' AND action = ?'
      params.push(opts.action)
    }
    return (this.db.prepare(query).get(...params) as any).c
  }

  /**
   * Limpia entradas antiguas
   */
  cleanup(olderThanDays: number = 90): number {
    const result = this.db.prepare(`
      DELETE FROM audit_log WHERE created_at < datetime('now', '-' || ? || ' days')
    `).run(olderThanDays)
    log.info({ deleted: result.changes, olderThanDays }, 'Audit log cleanup')
    return result.changes
  }
}
