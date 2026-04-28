// src/crm/deals.ts
// Pipeline de deals CRM

import Database, { Database as DatabaseType } from 'better-sqlite3'
import { generateId } from '../db/database'

export interface Deal {
  id: string
  contact_phone: string
  contact_name?: string
  stage: string
  value: number | null
  probability: number
  notes: string | null
  next_follow_up: string | null
  created_at: string
  updated_at: string
}

export const DEFAULT_STAGES = [
  'nuevo',
  'contactado',
  'interesado',
  'propuesta',
  'negociacion',
  'cerrado-ganado',
  'cerrado-perdido',
]

export interface PipelineView {
  stages: StageSummary[]
  totalDeals: number
  totalValue: number
}

export interface StageSummary {
  stage: string
  count: number
  value: number
  deals: Deal[]
}

export class DealManager {
  private db: DatabaseType
  private stages: string[]

  constructor(db: DatabaseType, stages?: string[]) {
    this.db = db
    this.stages = stages || DEFAULT_STAGES
  }

  /**
   * Crea un nuevo deal
   */
  create(contactPhone: string, value?: number, notes?: string): Deal {
    const id = generateId()
    this.db.prepare(`
      INSERT INTO deals (id, contact_phone, stage, value, notes)
      VALUES (?, ?, 'nuevo', ?, ?)
    `).run(id, contactPhone, value || null, notes || null)

    // Registrar actividad
    this.db.prepare(`
      INSERT INTO activities (id, contact_phone, type, description)
      VALUES (?, ?, 'deal_created', 'Deal creado')
    `).run(generateId(), contactPhone)

    return this.get(id)!
  }

  /**
   * Obtiene un deal por ID
   */
  get(id: string): Deal | null {
    const deal = this.db.prepare(`
      SELECT d.*, c.name as contact_name
      FROM deals d
      LEFT JOIN contacts c ON d.contact_phone = c.phone
      WHERE d.id = ?
    `).get(id) as any
    return deal || null
  }

  /**
   * Lista deals con filtros
   */
  list(filter?: { stage?: string; contactPhone?: string; limit?: number; cursor?: string }): Deal[] {
    let query = `
      SELECT d.*, c.name as contact_name
      FROM deals d
      LEFT JOIN contacts c ON d.contact_phone = c.phone
      WHERE 1=1
    `
    const params: any[] = []

    if (filter?.stage) {
      query += ' AND d.stage = ?'
      params.push(filter.stage)
    }

    if (filter?.contactPhone) {
      query += ' AND d.contact_phone = ?'
      params.push(filter.contactPhone)
    }

    // Cursor-based pagination
    if (filter?.cursor) {
      query += ' AND d.updated_at < ?'
      params.push(filter.cursor)
    }

    query += ' ORDER BY d.updated_at DESC'

    if (filter?.limit) {
      query += ' LIMIT ?'
      params.push(filter.limit)
    }

    return this.db.prepare(query).all(...params) as Deal[]
  }

  /**
   * Mueve un deal a una nueva etapa
   */
  moveStage(dealId: string, newStage: string): Deal | null {
    if (!this.stages.includes(newStage)) {
      throw new Error(`Etapa inválida: ${newStage}. Válidas: ${this.stages.join(', ')}`)
    }

    const deal = this.get(dealId)
    if (!deal) return null

    const oldStage = deal.stage

    this.db.prepare(`
      UPDATE deals SET stage = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newStage, dealId)

    // Registrar actividad
    this.db.prepare(`
      INSERT INTO activities (id, contact_phone, type, description, metadata)
      VALUES (?, ?, 'stage_change', ?, ?)
    `).run(
      generateId(),
      deal.contact_phone,
      `Deal movido: ${oldStage} → ${newStage}`,
      JSON.stringify({ dealId, oldStage, newStage })
    )

    return this.get(dealId)
  }

  /**
   * Actualiza un deal
   */
  update(id: string, data: Partial<Deal>): Deal | null {
    const fields: string[] = []
    const values: any[] = []

    if (data.value !== undefined) { fields.push('value = ?'); values.push(data.value) }
    if (data.probability !== undefined) { fields.push('probability = ?'); values.push(data.probability) }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes) }
    if (data.next_follow_up !== undefined) { fields.push('next_follow_up = ?'); values.push(data.next_follow_up) }

    if (fields.length === 0) return this.get(id)

    fields.push("updated_at = datetime('now')")
    values.push(id)

    this.db.prepare(`UPDATE deals SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.get(id)
  }

  /**
   * Programa un follow-up
   */
  scheduleFollowUp(dealId: string, hoursFromNow: number): void {
    const followUp = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString()
    this.update(dealId, { next_follow_up: followUp })
  }

  /**
   * Obtiene el pipeline completo (vista Kanban)
   */
  getPipeline(): PipelineView {
    const stages: StageSummary[] = this.stages.map(stage => {
      const deals = this.list({ stage })
      const value = deals.reduce((sum, d) => sum + (d.value || 0), 0)
      return { stage, count: deals.length, value, deals }
    })

    const totalDeals = stages.reduce((sum, s) => sum + s.count, 0)
    const totalValue = stages.reduce((sum, s) => sum + s.value, 0)

    return { stages, totalDeals, totalValue }
  }

  /**
   * Obtiene deals con follow-up pendiente
   */
  getPendingFollowUps(): Deal[] {
    return this.db.prepare(`
      SELECT d.*, c.name as contact_name
      FROM deals d
      LEFT JOIN contacts c ON d.contact_phone = c.phone
      WHERE d.next_follow_up <= datetime('now')
        AND d.stage NOT IN ('cerrado-ganado', 'cerrado-perdido')
      ORDER BY d.next_follow_up ASC
    `).all() as Deal[]
  }

  /**
   * Obtiene el deal activo de un contacto
   */
  getActiveDeal(contactPhone: string): Deal | null {
    return this.db.prepare(`
      SELECT d.*, c.name as contact_name
      FROM deals d
      LEFT JOIN contacts c ON d.contact_phone = c.phone
      WHERE d.contact_phone = ?
        AND d.stage NOT IN ('cerrado-ganado', 'cerrado-perdido')
      ORDER BY d.updated_at DESC LIMIT 1
    `).get(contactPhone) as Deal || null
  }

  /**
   * Cierra un deal (ganado o perdido)
   */
  close(dealId: string, won: boolean): Deal | null {
    const stage = won ? 'cerrado-ganado' : 'cerrado-perdido'
    return this.moveStage(dealId, stage)
  }

  /**
   * Estadísticas del pipeline
   */
  getStats(): {
    total: number
    open: number
    closedWon: number
    closedLost: number
    totalValue: number
    conversionRate: number
  } {
    const all = this.list()
    const open = all.filter(d => !d.stage.startsWith('cerrado'))
    const closedWon = all.filter(d => d.stage === 'cerrado-ganado')
    const closedLost = all.filter(d => d.stage === 'cerrado-perdido')
    const totalValue = closedWon.reduce((sum, d) => sum + (d.value || 0), 0)
    const conversionRate = all.length > 0 ? (closedWon.length / all.length) * 100 : 0

    return {
      total: all.length,
      open: open.length,
      closedWon: closedWon.length,
      closedLost: closedLost.length,
      totalValue,
      conversionRate: Math.round(conversionRate * 10) / 10,
    }
  }

  /**
   * Obtiene las etapas disponibles
   */
  getStages(): string[] {
    return [...this.stages]
  }
}
