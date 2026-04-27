// src/crm/contacts.ts
// Gestión de contactos CRM

import Database, { Database as DatabaseType } from 'better-sqlite3'
import { generateId } from '../db/database'

export interface Contact {
  id: string
  name: string | null
  phone: string
  email: string | null
  company: string | null
  tags: string[]
  score: number
  source: string | null
  whatsapp: boolean
  consent: boolean
  created_at: string
  updated_at: string
}

export interface ContactFilter {
  search?: string
  tags?: string[]
  minScore?: number
  whatsapp?: boolean
  limit?: number
  offset?: number
}

export class ContactManager {
  private db: DatabaseType

  constructor(db: DatabaseType) {
    this.db = db
  }

  /**
   * Lista contactos con filtros
   */
  list(filter?: ContactFilter): Contact[] {
    let query = 'SELECT * FROM contacts WHERE 1=1'
    const params: any[] = []

    if (filter?.search) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)'
      const search = `%${filter.search}%`
      params.push(search, search, search)
    }

    if (filter?.tags && filter.tags.length > 0) {
      const tagConditions = filter.tags.map(() => 'tags LIKE ?').join(' OR ')
      query += ` AND (${tagConditions})`
      filter.tags.forEach(tag => params.push(`%${tag}%`))
    }

    if (filter?.minScore !== undefined) {
      query += ' AND score >= ?'
      params.push(filter.minScore)
    }

    if (filter?.whatsapp !== undefined) {
      query += ' AND whatsapp = ?'
      params.push(filter.whatsapp ? 1 : 0)
    }

    query += ' ORDER BY created_at DESC'

    if (filter?.limit) {
      query += ' LIMIT ?'
      params.push(filter.limit)
    }

    if (filter?.offset) {
      query += ' OFFSET ?'
      params.push(filter.offset)
    }

    const contacts = this.db.prepare(query).all(...params) as any[]
    return contacts.map(c => ({
      ...c,
      tags: c.tags ? JSON.parse(c.tags) : [],
      whatsapp: !!c.whatsapp,
      consent: !!c.consent,
    }))
  }

  /**
   * Obtiene un contacto por ID
   */
  get(id: string): Contact | null {
    const contact = this.db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as any
    if (!contact) return null
    return {
      ...contact,
      tags: contact.tags ? JSON.parse(contact.tags) : [],
      whatsapp: !!contact.whatsapp,
      consent: !!contact.consent,
    }
  }

  /**
   * Obtiene un contacto por teléfono
   */
  getByPhone(phone: string): Contact | null {
    const contact = this.db.prepare('SELECT * FROM contacts WHERE phone = ?').get(phone) as any
    if (!contact) return null
    return {
      ...contact,
      tags: contact.tags ? JSON.parse(contact.tags) : [],
      whatsapp: !!contact.whatsapp,
      consent: !!contact.consent,
    }
  }

  /**
   * Actualiza un contacto
   */
  update(id: string, data: Partial<Contact>): Contact | null {
    const fields: string[] = []
    const values: any[] = []

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email) }
    if (data.company !== undefined) { fields.push('company = ?'); values.push(data.company) }
    if (data.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(data.tags)) }
    if (data.score !== undefined) { fields.push('score = ?'); values.push(data.score) }
    if (data.whatsapp !== undefined) { fields.push('whatsapp = ?'); values.push(data.whatsapp ? 1 : 0) }
    if (data.consent !== undefined) { fields.push('consent = ?'); values.push(data.consent ? 1 : 0) }

    if (fields.length === 0) return this.get(id)

    fields.push("updated_at = datetime('now')")
    values.push(id)

    this.db.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.get(id)
  }

  /**
   * Agrega un tag a un contacto
   */
  addTag(id: string, tag: string): void {
    const contact = this.get(id)
    if (!contact) return

    if (!contact.tags.includes(tag)) {
      contact.tags.push(tag)
      this.update(id, { tags: contact.tags })
    }
  }

  /**
   * Remueve un tag de un contacto
   */
  removeTag(id: string, tag: string): void {
    const contact = this.get(id)
    if (!contact) return

    contact.tags = contact.tags.filter(t => t !== tag)
    this.update(id, { tags: contact.tags })
  }

  /**
   * Busca contactos por texto
   */
  search(query: string): Contact[] {
    return this.list({ search: query })
  }

  /**
   * Obtiene contactos por tag
   */
  getByTag(tag: string): Contact[] {
    return this.list({ tags: [tag] })
  }

  /**
   * Obtiene contactos con WhatsApp
   */
  getWithWhatsApp(limit?: number): Contact[] {
    return this.list({ whatsapp: true, limit })
  }

  /**
   * Cuenta total de contactos
   */
  count(): number {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM contacts').get() as any
    return result.count
  }

  /**
   * Estadísticas de contactos
   */
  getStats(): {
    total: number
    withWhatsApp: number
    withEmail: number
    avgScore: number
    bySource: Record<string, number>
  } {
    const total = this.count()
    const withWhatsApp = (this.db.prepare('SELECT COUNT(*) as c FROM contacts WHERE whatsapp = 1').get() as any).c
    const withEmail = (this.db.prepare('SELECT COUNT(*) as c FROM contacts WHERE email IS NOT NULL').get() as any).c
    const avgScore = (this.db.prepare('SELECT AVG(score) as avg FROM contacts').get() as any).avg || 0

    const bySource: Record<string, number> = {}
    const sources = this.db.prepare('SELECT source, COUNT(*) as c FROM contacts GROUP BY source').all() as any[]
    for (const s of sources) {
      bySource[s.source || 'unknown'] = s.c
    }

    return { total, withWhatsApp, withEmail, avgScore: Math.round(avgScore), bySource }
  }

  /**
   * Elimina un contacto
   */
  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM contacts WHERE id = ?').run(id)
    return result.changes > 0
  }
}
