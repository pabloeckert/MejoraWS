// tests/integration/api/contacts.api.test.ts
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import express from 'express'
import Database from 'better-sqlite3'
import { ContactManager } from '../../../src/crm/contacts'
import { ContactImporter } from '../../../src/importer/pipeline'
import { contactsRouter } from '../../../src/api/routes/contacts'
import { errorHandler } from '../../../src/api/middleware/error'
import { initDatabase } from '../../../src/db/database'
import request from 'supertest'

const TEST_DB = '/tmp/test-api-contacts-' + Date.now() + '.db'

describe('Contacts API', () => {
  let db: Database.Database
  let app: express.Application

  beforeEach(() => {
    db = initDatabase(TEST_DB)
    const contacts = new ContactManager(db)
    const importer = new ContactImporter(db)

    app = express()
    app.use(express.json())
    app.use('/api/v1/contacts', contactsRouter(contacts, importer))
    app.use(errorHandler)
  })

  afterEach(() => {
    db.close()
    try { require('fs').unlinkSync(TEST_DB) } catch {}
  })

  describe('GET /api/v1/contacts', () => {
    it('returns empty list', async () => {
      const res = await request(app).get('/api/v1/contacts')
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
      expect(res.body.pagination.total).toBe(0)
    })

    it('returns contacts', async () => {
      db.prepare(`INSERT INTO contacts (id, name, phone, tags, score) VALUES ('t1', 'Pedro', '5491111111111', '[]', 50)`).run()

      const res = await request(app).get('/api/v1/contacts')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.data[0].name).toBe('Pedro')
    })

    it('supports search filter', async () => {
      db.prepare(`INSERT INTO contacts (id, name, phone, tags, score) VALUES ('t1', 'Pedro', '5491111111111', '[]', 50)`).run()
      db.prepare(`INSERT INTO contacts (id, name, phone, tags, score) VALUES ('t2', 'Ana', '5491122222222', '[]', 60)`).run()

      const res = await request(app).get('/api/v1/contacts?search=Pedro')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBe(1)
      expect(res.body.data[0].name).toBe('Pedro')
    })
  })

  describe('GET /api/v1/contacts/:id', () => {
    it('returns contact by id', async () => {
      db.prepare(`INSERT INTO contacts (id, name, phone, tags, score) VALUES ('t1', 'Pedro', '5491111111111', '[]', 50)`).run()

      const res = await request(app).get('/api/v1/contacts/t1')
      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe('Pedro')
    })

    it('returns 404 for missing contact', async () => {
      const res = await request(app).get('/api/v1/contacts/nonexistent')
      expect(res.status).toBe(404)
      expect(res.body.code).toBe('CONTACT_NOT_FOUND')
    })
  })

  describe('POST /api/v1/contacts', () => {
    it('creates a contact', async () => {
      const res = await request(app)
        .post('/api/v1/contacts')
        .send({ name: 'Pedro', phone: '5491112345678' })

      expect(res.status).toBe(201)
      expect(res.body.data.name).toBe('Pedro')
      expect(res.body.data.phone).toBe('5491112345678')
    })

    it('rejects invalid data', async () => {
      const res = await request(app)
        .post('/api/v1/contacts')
        .send({ name: 'Pedro' }) // missing phone

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('rejects duplicate phone', async () => {
      db.prepare(`INSERT INTO contacts (id, name, phone, tags, score) VALUES ('t1', 'Pedro', '5491112345678', '[]', 50)`).run()

      const res = await request(app)
        .post('/api/v1/contacts')
        .send({ name: 'Pedro 2', phone: '5491112345678' })

      expect(res.status).toBe(409)
    })
  })

  describe('PUT /api/v1/contacts/:id', () => {
    it('updates a contact', async () => {
      db.prepare(`INSERT INTO contacts (id, name, phone, tags, score) VALUES ('t1', 'Pedro', '5491111111111', '[]', 50)`).run()

      const res = await request(app)
        .put('/api/v1/contacts/t1')
        .send({ name: 'Pedro Updated', score: 90 })

      expect(res.status).toBe(200)
      expect(res.body.data.name).toBe('Pedro Updated')
      expect(res.body.data.score).toBe(90)
    })
  })

  describe('DELETE /api/v1/contacts/:id', () => {
    it('deletes a contact', async () => {
      db.prepare(`INSERT INTO contacts (id, name, phone, tags, score) VALUES ('t1', 'Pedro', '5491111111111', '[]', 50)`).run()

      const res = await request(app).delete('/api/v1/contacts/t1')
      expect(res.status).toBe(204)
    })

    it('returns 404 for missing', async () => {
      const res = await request(app).delete('/api/v1/contacts/nonexistent')
      expect(res.status).toBe(404)
    })
  })
})
