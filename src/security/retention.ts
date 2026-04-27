// src/security/retention.ts
// Data retention policy — auto-cleanup de datos antiguos

import Database, { Database as DatabaseType } from 'better-sqlite3'
import { childLogger } from '../utils/logger'

const log = childLogger('security:retention')

export interface RetentionPolicy {
  messagesDays: number    // Borrar mensajes después de N días
  activitiesDays: number  // Borrar actividades después de N días
  auditDays: number       // Borrar audit log después de N días
  analyticsDays: number   // Borrar analytics después de N días
}

const DEFAULT_POLICY: RetentionPolicy = {
  messagesDays: 180,   // 6 meses
  activitiesDays: 365, // 1 año
  auditDays: 90,       // 3 meses
  analyticsDays: 730,  // 2 años
}

export class DataRetention {
  private db: DatabaseType
  private policy: RetentionPolicy

  constructor(db: DatabaseType, policy?: Partial<RetentionPolicy>) {
    this.db = db
    this.policy = { ...DEFAULT_POLICY, ...policy }
  }

  /**
   * Ejecuta la limpieza de datos según la política de retención
   */
  runCleanup(): {
    messagesDeleted: number
    activitiesDeleted: number
    auditDeleted: number
  } {
    const messagesDeleted = this.db.prepare(`
      DELETE FROM messages WHERE created_at < datetime('now', '-' || ? || ' days')
    `).run(this.policy.messagesDays).changes

    const activitiesDeleted = this.db.prepare(`
      DELETE FROM activities WHERE created_at < datetime('now', '-' || ? || ' days')
    `).run(this.policy.activitiesDays).changes

    const auditDeleted = this.db.prepare(`
      DELETE FROM audit_log WHERE created_at < datetime('now', '-' || ? || ' days')
    `).run(this.policy.auditDays).changes

    log.info({
      messagesDeleted,
      activitiesDeleted,
      auditDeleted,
      policy: this.policy,
    }, 'Data retention cleanup completed')

    return { messagesDeleted, activitiesDeleted, auditDeleted }
  }

  /**
   * Obtiene estadísticas de datos almacenados
   */
  getStats(): {
    messages: number
    activities: number
    audit: number
    contacts: number
    deals: number
    campaigns: number
    oldestMessage: string | null
    oldestActivity: string | null
  } {
    const count = (table: string) => (this.db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as any).c

    const oldest = (table: string, col: string = 'created_at') => {
      const row = this.db.prepare(`SELECT MIN(${col}) as d FROM ${table}`).get() as any
      return row?.d || null
    }

    return {
      messages: count('messages'),
      activities: count('activities'),
      audit: count('audit_log'),
      contacts: count('contacts'),
      deals: count('deals'),
      campaigns: count('campaigns'),
      oldestMessage: oldest('messages'),
      oldestActivity: oldest('activities'),
    }
  }

  /**
   * Obtiene la política actual
   */
  getPolicy(): RetentionPolicy {
    return { ...this.policy }
  }

  /**
   * Actualiza la política
   */
  updatePolicy(policy: Partial<RetentionPolicy>): void {
    Object.assign(this.policy, policy)
    log.info({ policy: this.policy }, 'Retention policy updated')
  }
}
