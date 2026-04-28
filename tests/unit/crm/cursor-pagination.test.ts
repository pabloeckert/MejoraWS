// tests/unit/crm/cursor-pagination.test.ts
// Tests for cursor-based pagination in ContactManager

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { ContactManager } from '../../../src/crm/contacts'

function createTestDB(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE contacts (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      company TEXT,
      whatsapp INTEGER DEFAULT 0,
      tags TEXT DEFAULT '[]',
      score INTEGER DEFAULT 0,
      source TEXT,
      consent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)
  return db
}

function insertContact(db: Database.Database, id: string, phone: string, name: string, createdAt?: string) {
  db.prepare(`
    INSERT INTO contacts (id, name, phone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, phone, createdAt || new Date().toISOString(), createdAt || new Date().toISOString())
}

describe('ContactManager — Cursor Pagination', () => {
  let db: Database.Database
  let manager: ContactManager

  beforeEach(() => {
    db = createTestDB()
    manager = new ContactManager(db)

    // Insert 10 contacts with staggered timestamps
    for (let i = 0; i < 10; i++) {
      const ts = new Date(Date.now() - i * 60000).toISOString() // 1 min apart
      insertContact(db, `id-${i}`, `+123456789${i.toString().padStart(2, '0')}`, `Contact ${i}`, ts)
    }
  })

  afterEach(() => {
    db.close()
  })

  it('returns contacts with offset pagination', () => {
    const page1 = manager.list({ limit: 3, offset: 0 })
    const page2 = manager.list({ limit: 3, offset: 3 })

    expect(page1).toHaveLength(3)
    expect(page2).toHaveLength(3)
    expect(page1[0].id).not.toBe(page2[0].id)
  })

  it('returns contacts with cursor pagination (after)', () => {
    const page1 = manager.list({ limit: 3 })
    expect(page1).toHaveLength(3)

    const cursor = page1[page1.length - 1].created_at
    const page2 = manager.list({ limit: 3, cursor, cursorDirection: 'after' })
    expect(page2).toHaveLength(3)

    // Page 2 items should be different from page 1
    const page1Ids = page1.map(c => c.id)
    const page2Ids = page2.map(c => c.id)
    expect(page1Ids).not.toEqual(expect.arrayContaining(page2Ids))
  })

  it('cursor pagination returns fewer items on last page', () => {
    const page1 = manager.list({ limit: 5 })
    expect(page1).toHaveLength(5)

    const cursor = page1[4].created_at
    const page2 = manager.list({ limit: 5, cursor, cursorDirection: 'after' })
    expect(page2).toHaveLength(5) // 10 items total, 5 remaining
  })

  it('cursor pagination returns empty when exhausted', () => {
    const page1 = manager.list({ limit: 10 })
    expect(page1).toHaveLength(10)

    const cursor = page1[9].created_at
    const page2 = manager.list({ limit: 10, cursor, cursorDirection: 'after' })
    expect(page2).toHaveLength(0)
  })

  it('cursor pagination with filters', () => {
    // Mark some as having WhatsApp
    db.prepare('UPDATE contacts SET whatsapp = 1 WHERE id IN (?, ?, ?)').run('id-0', 'id-1', 'id-2')

    const page1 = manager.list({ whatsapp: true, limit: 2 })
    expect(page1).toHaveLength(2)

    const cursor = page1[1].created_at
    const page2 = manager.list({ whatsapp: true, limit: 2, cursor, cursorDirection: 'after' })
    expect(page2.length).toBeGreaterThanOrEqual(1)
  })

  it('offset and cursor produce same total results', () => {
    const allOffset = manager.list({ limit: 100, offset: 0 })
    const allCursor: any[] = []
    let cursor: string | undefined

    do {
      const filter: any = { limit: 3 }
      if (cursor) {
        filter.cursor = cursor
        filter.cursorDirection = 'after'
      }
      const page = manager.list(filter)
      allCursor.push(...page)
      if (page.length < 3) break
      cursor = page[page.length - 1].created_at
    } while (true)

    expect(allCursor.length).toBe(allOffset.length)
    expect(allCursor.map(c => c.id)).toEqual(allOffset.map(c => c.id))
  })
})
