// tests/unit/crm/contacts.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { ContactManager } from '../../../src/crm/contacts'
import { initDatabase } from '../../../src/db/database'

const TEST_DB_PATH = '/tmp/test-contacts-' + Date.now() + '.db'

describe('ContactManager', () => {
  let db: Database.Database
  let contacts: ContactManager

  beforeEach(() => {
    db = initDatabase(TEST_DB_PATH)
    contacts = new ContactManager(db)
  })

  afterEach(() => {
    db.close()
    try { require('fs').unlinkSync(TEST_DB_PATH) } catch {}
  })

  describe('list()', () => {
    it('returns empty array when no contacts', () => {
      const result = contacts.list()
      expect(result).toEqual([])
    })
  })

  describe('getStats()', () => {
    it('returns zero stats for empty db', () => {
      const stats = contacts.getStats()
      expect(stats.total).toBe(0)
      expect(stats.withWhatsApp).toBe(0)
      expect(stats.withEmail).toBe(0)
      expect(stats.avgScore).toBe(0)
    })
  })

  describe('CRUD via raw DB', () => {
    it('inserts and retrieves a contact', () => {
      db.prepare(`
        INSERT INTO contacts (id, name, phone, email, whatsapp, tags, score)
        VALUES ('test1', 'Pedro', '5491112345678', 'pedro@test.com', 1, '[]', 75)
      `).run()

      const contact = contacts.get('test1')
      expect(contact).not.toBeNull()
      expect(contact!.name).toBe('Pedro')
      expect(contact!.phone).toBe('5491112345678')
      expect(contact!.email).toBe('pedro@test.com')
      expect(contact!.whatsapp).toBe(true)
      expect(contact!.score).toBe(75)
    })

    it('updates a contact', () => {
      db.prepare(`
        INSERT INTO contacts (id, name, phone, tags, score)
        VALUES ('test2', 'Ana', '5491198765432', '[]', 50)
      `).run()

      contacts.update('test2', { name: 'Ana Updated', score: 90 })
      const updated = contacts.get('test2')
      expect(updated!.name).toBe('Ana Updated')
      expect(updated!.score).toBe(90)
    })

    it('deletes a contact', () => {
      db.prepare(`
        INSERT INTO contacts (id, name, phone, tags, score)
        VALUES ('test3', 'Luis', '5491155555555', '[]', 30)
      `).run()

      const deleted = contacts.delete('test3')
      expect(deleted).toBe(true)
      expect(contacts.get('test3')).toBeNull()
    })

    it('searches contacts', () => {
      db.prepare(`INSERT INTO contacts (id, name, phone, tags, score) VALUES ('t1', 'Pedro García', '5491111111111', '[]', 50)`).run()
      db.prepare(`INSERT INTO contacts (id, name, phone, tags, score) VALUES ('t2', 'Ana López', '5491122222222', '[]', 60)`).run()

      const results = contacts.search('Pedro')
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('Pedro García')
    })

    it('filters by whatsapp', () => {
      db.prepare(`INSERT INTO contacts (id, name, phone, whatsapp, tags, score) VALUES ('t1', 'Pedro', '5491111111111', 1, '[]', 50)`).run()
      db.prepare(`INSERT INTO contacts (id, name, phone, whatsapp, tags, score) VALUES ('t2', 'Ana', '5491122222222', 0, '[]', 60)`).run()

      const waContacts = contacts.getWithWhatsApp()
      expect(waContacts.length).toBe(1)
      expect(waContacts[0].name).toBe('Pedro')
    })
  })
})
