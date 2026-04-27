// tests/integration/api/deals.api.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import Database from 'better-sqlite3'
import { DealManager } from '../../../src/crm/deals'
import { dealsRouter } from '../../../src/api/routes/deals'
import { errorHandler } from '../../../src/api/middleware/error'
import { initDatabase } from '../../../src/db/database'
import request from 'supertest'

const TEST_DB = '/tmp/test-api-deals-' + Date.now() + '.db'

describe('Deals API', () => {
  let db: Database.Database
  let app: express.Application

  beforeEach(() => {
    db = initDatabase(TEST_DB)
    const deals = new DealManager(db)

    // Insert test contact
    db.prepare(`INSERT INTO contacts (id, name, phone, tags, score) VALUES ('c1', 'Pedro', '5491111111111', '[]', 50)`).run()

    app = express()
    app.use(express.json())
    app.use('/api/v1/deals', dealsRouter(deals))
    app.use(errorHandler)
  })

  afterEach(() => {
    db.close()
    try { require('fs').unlinkSync(TEST_DB) } catch {}
  })

  describe('GET /api/v1/deals', () => {
    it('returns empty list', async () => {
      const res = await request(app).get('/api/v1/deals')
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual([])
    })
  })

  describe('GET /api/v1/deals/pipeline', () => {
    it('returns pipeline view', async () => {
      const res = await request(app).get('/api/v1/deals/pipeline')
      expect(res.status).toBe(200)
      expect(res.body.data.stages.length).toBe(7)
      expect(res.body.data.totalDeals).toBe(0)
    })
  })

  describe('GET /api/v1/deals/stats', () => {
    it('returns stats', async () => {
      const res = await request(app).get('/api/v1/deals/stats')
      expect(res.status).toBe(200)
      expect(res.body.data.total).toBe(0)
    })
  })

  describe('POST /api/v1/deals', () => {
    it('creates a deal', async () => {
      const res = await request(app)
        .post('/api/v1/deals')
        .send({ contact_phone: '5491111111111', value: 1500 })

      expect(res.status).toBe(201)
      expect(res.body.data.stage).toBe('nuevo')
      expect(res.body.data.value).toBe(1500)
    })

    it('rejects invalid data', async () => {
      const res = await request(app)
        .post('/api/v1/deals')
        .send({}) // missing contact_phone

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('PATCH /api/v1/deals/:id/stage', () => {
    it('moves deal stage', async () => {
      const createRes = await request(app)
        .post('/api/v1/deals')
        .send({ contact_phone: '5491111111111', value: 100 })

      const dealId = createRes.body.data.id

      const res = await request(app)
        .patch(`/api/v1/deals/${dealId}/stage`)
        .send({ stage: 'contactado' })

      expect(res.status).toBe(200)
      expect(res.body.data.stage).toBe('contactado')
    })

    it('rejects invalid stage', async () => {
      const createRes = await request(app)
        .post('/api/v1/deals')
        .send({ contact_phone: '5491111111111' })

      const dealId = createRes.body.data.id

      const res = await request(app)
        .patch(`/api/v1/deals/${dealId}/stage`)
        .send({ stage: 'invalid' })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/v1/deals/:id/close', () => {
    it('closes deal as won', async () => {
      const createRes = await request(app)
        .post('/api/v1/deals')
        .send({ contact_phone: '5491111111111', value: 500 })

      const dealId = createRes.body.data.id

      const res = await request(app)
        .post(`/api/v1/deals/${dealId}/close`)
        .send({ won: true })

      expect(res.status).toBe(200)
      expect(res.body.data.stage).toBe('cerrado-ganado')
    })
  })
})
