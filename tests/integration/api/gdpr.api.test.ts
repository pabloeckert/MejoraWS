// tests/integration/api/gdpr.api.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import Database from 'better-sqlite3'
import { gdprRouter } from '../../../src/api/routes/gdpr'
import { AuditLogger } from '../../../src/security/audit'
import { errorHandler } from '../../../src/api/middleware/error'
import { initDatabase } from '../../../src/db/database'
import request from 'supertest'

const TEST_DB = '/tmp/test-gdpr-' + Date.now() + '.db'

describe('GDPR API', () => {
  let db: Database.Database
  let app: express.Application

  beforeEach(() => {
    db = initDatabase(TEST_DB)
    const audit = new AuditLogger(db)

    // Insert test data
    db.prepare(`INSERT INTO contacts (id, name, phone, email, consent, tags, score) VALUES ('c1', 'Pedro', '5491111111111', 'pedro@test.com', 1, '[]', 50)`).run()
    db.prepare(`INSERT INTO messages (id, contact_phone, direction, content) VALUES ('m1', '5491111111111', 'inbound', 'Hola')`).run()
    db.prepare(`INSERT INTO messages (id, contact_phone, direction, content) VALUES ('m2', '5491111111111', 'outbound', 'Buenos días!')`).run()

    app = express()
    app.use(express.json())
    app.use('/api/v1/gdpr', gdprRouter(db, audit))
    app.use(errorHandler)
  })

  afterEach(() => {
    db.close()
    try { require('fs').unlinkSync(TEST_DB) } catch {}
  })

  describe('GET /api/v1/gdpr/export/:phone', () => {
    it('exports all contact data', async () => {
      const res = await request(app).get('/api/v1/gdpr/export/5491111111111')
      expect(res.status).toBe(200)
      expect(res.body.contact.phone).toBe('5491111111111')
      expect(res.body.contact.name).toBe('Pedro')
      expect(res.body.contact.email).toBe('pedro@test.com')
      expect(res.body.messages.length).toBe(2)
      expect(res.body.totalMessages).toBe(2)
    })

    it('returns 404 for unknown phone', async () => {
      const res = await request(app).get('/api/v1/gdpr/export/999999999')
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/v1/gdpr/erase/:phone', () => {
    it('erases all contact data', async () => {
      const res = await request(app).delete('/api/v1/gdpr/erase/5491111111111')
      expect(res.status).toBe(200)
      expect(res.body.data.contactDeleted).toBe(1)
      expect(res.body.data.messagesDeleted).toBe(2)

      // Verify deletion
      const contact = db.prepare('SELECT * FROM contacts WHERE phone = ?').get('5491111111111')
      expect(contact).toBeUndefined()

      const messages = db.prepare('SELECT * FROM messages WHERE contact_phone = ?').all('5491111111111')
      expect(messages.length).toBe(0)
    })

    it('returns 404 for unknown phone', async () => {
      const res = await request(app).delete('/api/v1/gdpr/erase/999999999')
      expect(res.status).toBe(404)
    })
  })

  describe('PUT /api/v1/gdpr/consent/:phone', () => {
    it('updates consent', async () => {
      const res = await request(app)
        .put('/api/v1/gdpr/consent/5491111111111')
        .send({ consent: false })

      expect(res.status).toBe(200)
      expect(res.body.data.consent).toBe(false)

      // Verify
      const contact = db.prepare('SELECT consent FROM contacts WHERE phone = ?').get('5491111111111') as any
      expect(contact.consent).toBe(0)
    })

    it('rejects invalid consent value', async () => {
      const res = await request(app)
        .put('/api/v1/gdpr/consent/5491111111111')
        .send({ consent: 'yes' })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/v1/gdpr/stats', () => {
    it('returns compliance stats', async () => {
      const res = await request(app).get('/api/v1/gdpr/stats')
      expect(res.status).toBe(200)
      expect(res.body.data.contacts.total).toBe(1)
      expect(res.body.data.contacts.withConsent).toBe(1)
      expect(res.body.data.messages.total).toBe(2)
    })
  })
})
