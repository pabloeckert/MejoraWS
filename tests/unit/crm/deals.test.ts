// tests/unit/crm/deals.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { DealManager, DEFAULT_STAGES } from '../../../src/crm/deals'
import { initDatabase } from '../../../src/db/database'

const TEST_DB_PATH = '/tmp/test-deals-' + Date.now() + '.db'

describe('DealManager', () => {
  let db: Database.Database
  let deals: DealManager

  beforeEach(() => {
    db = initDatabase(TEST_DB_PATH)
    deals = new DealManager(db)

    // Insert a contact for foreign key consistency
    db.prepare(`INSERT INTO contacts (id, name, phone, tags, score) VALUES ('c1', 'Pedro', '5491111111111', '[]', 50)`).run()
  })

  afterEach(() => {
    db.close()
    try { require('fs').unlinkSync(TEST_DB_PATH) } catch {}
  })

  describe('create()', () => {
    it('creates a deal in nuevo stage', () => {
      const deal = deals.create('5491111111111', 1000)
      expect(deal).not.toBeNull()
      expect(deal.stage).toBe('nuevo')
      expect(deal.value).toBe(1000)
      expect(deal.contact_phone).toBe('5491111111111')
    })

    it('creates deal without value', () => {
      const deal = deals.create('5491111111111')
      expect(deal.value).toBeNull()
    })
  })

  describe('moveStage()', () => {
    it('moves deal between stages', () => {
      const deal = deals.create('5491111111111')
      const moved = deals.moveStage(deal.id, 'contactado')
      expect(moved!.stage).toBe('contactado')
    })

    it('rejects invalid stage', () => {
      const deal = deals.create('5491111111111')
      expect(() => deals.moveStage(deal.id, 'invalid-stage')).toThrow('Etapa inválida')
    })

    it('returns null for non-existent deal', () => {
      const result = deals.moveStage('nonexistent', 'contactado')
      expect(result).toBeNull()
    })
  })

  describe('getPipeline()', () => {
    it('returns empty pipeline', () => {
      const pipeline = deals.getPipeline()
      expect(pipeline.totalDeals).toBe(0)
      expect(pipeline.totalValue).toBe(0)
      expect(pipeline.stages.length).toBe(DEFAULT_STAGES.length)
    })

    it('counts deals per stage', () => {
      deals.create('5491111111111', 500)
      deals.create('5491111111111', 1000)

      const pipeline = deals.getPipeline()
      expect(pipeline.totalDeals).toBe(2)
      expect(pipeline.totalValue).toBe(1500)

      const nuevoStage = pipeline.stages.find(s => s.stage === 'nuevo')
      expect(nuevoStage!.count).toBe(2)
    })
  })

  describe('close()', () => {
    it('closes deal as won', () => {
      const deal = deals.create('5491111111111', 2000)
      const closed = deals.close(deal.id, true)
      expect(closed!.stage).toBe('cerrado-ganado')
    })

    it('closes deal as lost', () => {
      const deal = deals.create('5491111111111')
      const closed = deals.close(deal.id, false)
      expect(closed!.stage).toBe('cerrado-perdido')
    })
  })

  describe('getStats()', () => {
    it('returns zero stats for empty pipeline', () => {
      const stats = deals.getStats()
      expect(stats.total).toBe(0)
      expect(stats.open).toBe(0)
      expect(stats.closedWon).toBe(0)
      expect(stats.closedLost).toBe(0)
      expect(stats.totalValue).toBe(0)
      expect(stats.conversionRate).toBe(0)
    })

    it('calculates conversion rate', () => {
      const d1 = deals.create('5491111111111', 100)
      const d2 = deals.create('5491111111111', 200)
      deals.close(d1.id, true)
      deals.close(d2.id, false)

      const stats = deals.getStats()
      expect(stats.total).toBe(2)
      expect(stats.closedWon).toBe(1)
      expect(stats.closedLost).toBe(1)
      expect(stats.conversionRate).toBe(50)
    })
  })

  describe('scheduleFollowUp()', () => {
    it('schedules a follow-up', () => {
      const deal = deals.create('5491111111111')
      deals.scheduleFollowUp(deal.id, 24)

      const updated = deals.get(deal.id)
      expect(updated!.next_follow_up).not.toBeNull()
    })
  })
})
