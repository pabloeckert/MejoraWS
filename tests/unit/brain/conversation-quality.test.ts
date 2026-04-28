// tests/unit/brain/conversation-quality.test.ts
// Tests for conversation quality scoring

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { ConversationQualityScorer } from '../../../src/brain/conversation-quality'

function createTestDB(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE contacts (
      id TEXT PRIMARY KEY, name TEXT, phone TEXT UNIQUE, email TEXT, company TEXT,
      whatsapp INTEGER DEFAULT 0, tags TEXT DEFAULT '[]', score INTEGER DEFAULT 0,
      source TEXT, consent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE messages (
      id TEXT PRIMARY KEY, contact_phone TEXT NOT NULL, direction TEXT NOT NULL,
      content TEXT NOT NULL, status TEXT DEFAULT 'sent', campaign_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE activities (
      id TEXT PRIMARY KEY, contact_phone TEXT NOT NULL, type TEXT NOT NULL,
      description TEXT, metadata TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE deals (
      id TEXT PRIMARY KEY, contact_phone TEXT NOT NULL, stage TEXT DEFAULT 'nuevo',
      value REAL, probability INTEGER DEFAULT 0, notes TEXT, next_follow_up TEXT,
      created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
    );
  `)
  return db
}

describe('ConversationQualityScorer', () => {
  let db: Database.Database
  let scorer: ConversationQualityScorer

  beforeEach(() => {
    db = createTestDB()
    scorer = new ConversationQualityScorer(db)
  })

  afterEach(() => {
    db.close()
  })

  it('returns null for non-existent conversation', () => {
    const score = scorer.scoreConversation('+1234567890')
    expect(score).toBeNull()
  })

  it('scores a simple inbound/outbound conversation', () => {
    // Insert contact
    db.prepare(`INSERT INTO contacts (id, name, phone) VALUES ('c1', 'Juan', '+1234567890')`).run()

    // Insert messages
    const now = new Date().toISOString()
    db.prepare(`INSERT INTO messages (id, contact_phone, direction, content, created_at) VALUES ('m1', '+1234567890', 'inbound', 'Hola', ?)`).run(now)
    db.prepare(`INSERT INTO messages (id, contact_phone, direction, content, created_at) VALUES ('m2', '+1234567890', 'outbound', '¡Hola! ¿En qué puedo ayudarte?', ?)`).run(now)

    // Insert activity with intent
    db.prepare(`INSERT INTO activities (id, contact_phone, type, metadata) VALUES ('a1', '+1234567890', 'bot_reply', '{"intent":"CONSULTA","responseLength":30}')`).run()

    const score = scorer.scoreConversation('+1234567890')!

    expect(score).not.toBeNull()
    expect(score.phone).toBe('+1234567890')
    expect(score.contactName).toBe('Juan')
    expect(score.totalMessages).toBe(2)
    expect(score.inboundMessages).toBe(1)
    expect(score.outboundMessages).toBe(1)
    expect(score.autoResolved).toBe(true)
    expect(score.escalated).toBe(false)
    expect(score.intents).toEqual({ CONSULTA: 1 })
    expect(score.qualityScore).toBeGreaterThanOrEqual(50)
    expect(score.qualityScore).toBeLessThanOrEqual(100)
    expect(score.summary).toBeTruthy()
  })

  it('detects escalated conversations', () => {
    db.prepare(`INSERT INTO contacts (id, name, phone) VALUES ('c1', 'Ana', '+9876543210')`).run()

    const now = new Date().toISOString()
    db.prepare(`INSERT INTO messages (id, contact_phone, direction, content, created_at) VALUES ('m1', '+9876543210', 'inbound', 'Quiero hablar con alguien', ?)`).run(now)
    db.prepare(`INSERT INTO messages (id, contact_phone, direction, content, created_at) VALUES ('m2', '+9876543210', 'outbound', 'Te conectamos con un asesor humano', ?)`).run(now)

    const score = scorer.scoreConversation('+9876543210')!

    expect(score.escalated).toBe(true)
    expect(score.autoResolved).toBe(false)
  })

  it('getStats returns empty for no conversations', () => {
    const stats = scorer.getStats()
    expect(stats.totalConversations).toBe(0)
    expect(stats.avgQualityScore).toBe(0)
    expect(stats.topConversations).toEqual([])
  })

  it('getStats aggregates multiple conversations', () => {
    // Conversation 1
    db.prepare(`INSERT INTO contacts (id, name, phone) VALUES ('c1', 'A', '+111')`).run()
    db.prepare(`INSERT INTO messages (id, contact_phone, direction, content) VALUES ('m1', '+111', 'inbound', 'hola')`).run()
    db.prepare(`INSERT INTO messages (id, contact_phone, direction, content) VALUES ('m2', '+111', 'outbound', 'hola!')`).run()

    // Conversation 2
    db.prepare(`INSERT INTO contacts (id, name, phone) VALUES ('c2', 'B', '+222')`).run()
    db.prepare(`INSERT INTO messages (id, contact_phone, direction, content) VALUES ('m3', '+222', 'inbound', 'info')`).run()
    db.prepare(`INSERT INTO messages (id, contact_phone, direction, content) VALUES ('m4', '+222', 'outbound', 'te ayudo')`).run()

    const stats = scorer.getStats()
    expect(stats.totalConversations).toBe(2)
    expect(stats.topConversations.length).toBe(2)
    expect(stats.avgQualityScore).toBeGreaterThan(0)
  })
})
