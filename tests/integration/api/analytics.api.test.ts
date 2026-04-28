// tests/integration/api/analytics.api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import Database from 'better-sqlite3'
import express from 'express'
import { analyticsRouter } from '../../../src/api/routes/analytics'

describe('Analytics API', () => {
  let app: express.Application
  let db: Database.Database

  beforeAll(() => {
    db = new Database(':memory:')
    db.exec(`
      CREATE TABLE contacts (
        id TEXT PRIMARY KEY, name TEXT, phone TEXT UNIQUE NOT NULL, email TEXT,
        company TEXT, whatsapp INTEGER DEFAULT 0, tags TEXT DEFAULT '[]',
        score INTEGER DEFAULT 0, source TEXT, consent INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE messages (
        id TEXT PRIMARY KEY, contact_phone TEXT NOT NULL, direction TEXT NOT NULL,
        content TEXT NOT NULL, status TEXT DEFAULT 'sent', campaign_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE deals (
        id TEXT PRIMARY KEY, contact_phone TEXT NOT NULL, stage TEXT DEFAULT 'nuevo',
        value REAL, probability INTEGER DEFAULT 0, notes TEXT, next_follow_up TEXT,
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE activities (
        id TEXT PRIMARY KEY, contact_phone TEXT NOT NULL, type TEXT NOT NULL,
        description TEXT, metadata TEXT, created_at TEXT DEFAULT (datetime('now'))
      );
    `)

    // Seed data
    db.prepare(`INSERT INTO contacts (id, name, phone) VALUES ('c1', 'Pedro', '+5491111111111')`).run()
    db.prepare(`INSERT INTO contacts (id, name, phone) VALUES ('c2', 'Ana', '+5492222222222')`).run()

    db.prepare(`INSERT INTO messages (id, contact_phone, direction, content) VALUES ('m1', '+5491111111111', 'inbound', 'Hola')`).run()
    db.prepare(`INSERT INTO messages (id, contact_phone, direction, content) VALUES ('m2', '+5491111111111', 'outbound', 'Hola! ¿En qué puedo ayudarte?')`).run()
    db.prepare(`INSERT INTO messages (id, contact_phone, direction, content) VALUES ('m3', '+5492222222222', 'inbound', 'Precio?')`).run()
    db.prepare(`INSERT INTO messages (id, contact_phone, direction, content) VALUES ('m4', '+5492222222222', 'outbound', 'Te envío info')`).run()

    db.prepare(`INSERT INTO deals (id, contact_phone, stage, value) VALUES ('d1', '+5491111111111', 'cerrado-ganado', 500)`).run()
    db.prepare(`INSERT INTO deals (id, contact_phone, stage, value) VALUES ('d2', '+5492222222222', 'interesado', 0)`).run()

    db.prepare(`INSERT INTO activities (id, contact_phone, type, metadata) VALUES ('a1', '+5491111111111', 'auto-reply', '{"intent":"CONSULTA","sentiment":"positivo"}')`).run()
    db.prepare(`INSERT INTO activities (id, contact_phone, type, metadata) VALUES ('a2', '+5492222222222', 'auto-reply', '{"intent":"PRECIO","sentiment":"neutro"}')`).run()

    app = express()
    app.use(express.json())
    app.use('/api/v1/analytics', analyticsRouter(db))
  })

  afterAll(() => {
    db.close()
  })

  it('GET /api/v1/analytics/overview returns KPIs', async () => {
    const res = await request(app).get('/api/v1/analytics/overview')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('messages')
    expect(res.body.data).toHaveProperty('responseRate')
    expect(res.body.data).toHaveProperty('deals')
    expect(res.body.data).toHaveProperty('revenue')
    expect(res.body.data.messages.today).toBeGreaterThanOrEqual(0)
  })

  it('GET /api/v1/analytics/messages returns daily trends', async () => {
    const res = await request(app).get('/api/v1/analytics/messages')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET /api/v1/analytics/funnel returns conversion stages', async () => {
    const res = await request(app).get('/api/v1/analytics/funnel')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(4)
    expect(res.body.data[0].stage).toBe('Contactos')
    expect(res.body.data[0].count).toBe(2)
  })

  it('GET /api/v1/analytics/sentiment returns sentiment data', async () => {
    const res = await request(app).get('/api/v1/analytics/sentiment')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET /api/v1/analytics/timing returns hourly distribution', async () => {
    const res = await request(app).get('/api/v1/analytics/timing')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('hourly')
    expect(res.body.data).toHaveProperty('daily')
    expect(res.body.data).toHaveProperty('bestHour')
    expect(res.body.data).toHaveProperty('bestDay')
  })

  it('GET /api/v1/analytics/quality returns quality metrics', async () => {
    const res = await request(app).get('/api/v1/analytics/quality')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('totalConversations')
    expect(res.body.data).toHaveProperty('avgQualityScore')
    expect(res.body.data).toHaveProperty('autoResolutionRate')
    expect(res.body.data).toHaveProperty('escalationRate')
    expect(res.body.data).toHaveProperty('intentDistribution')
    expect(res.body.data).toHaveProperty('sentimentDistribution')
    expect(res.body.data).toHaveProperty('topConversations')
    expect(res.body.data.totalConversations).toBe(2)
  })

  it('GET /api/v1/analytics/export?type=messages returns CSV', async () => {
    const res = await request(app).get('/api/v1/analytics/export?type=messages')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.text).toContain('contact_phone')
  })

  it('GET /api/v1/analytics/export?type=invalid returns 400', async () => {
    const res = await request(app).get('/api/v1/analytics/export?type=invalid')
    expect(res.status).toBe(400)
  })

  it('GET /api/v1/analytics/export?type=contacts returns CSV', async () => {
    const res = await request(app).get('/api/v1/analytics/export?type=contacts')
    expect(res.status).toBe(200)
    expect(res.text).toContain('name')
    expect(res.text).toContain('Pedro')
  })
})
