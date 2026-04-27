// tests/unit/antiban/rate-limiter.test.ts
import { describe, it, expect, vi } from 'vitest'
import { gaussianDelay, typingDelay, pauseDelay, isWithinSchedule, sleep } from '../../../src/antiban/rate-limiter'

describe('rate-limiter', () => {
  describe('gaussianDelay', () => {
    it('returns delay within bounds (5s-20s)', () => {
      for (let i = 0; i < 100; i++) {
        const delay = gaussianDelay()
        expect(delay).toBeGreaterThanOrEqual(5000)
        expect(delay).toBeLessThanOrEqual(20000)
      }
    })

    it('returns delay close to mean', () => {
      const delays = Array.from({ length: 200 }, () => gaussianDelay(10000, 3000))
      const avg = delays.reduce((a, b) => a + b, 0) / delays.length
      expect(avg).toBeGreaterThan(8000)
      expect(avg).toBeLessThan(12000)
    })

    it('respects custom mean and stdDev', () => {
      for (let i = 0; i < 50; i++) {
        const delay = gaussianDelay(8000, 2000)
        expect(delay).toBeGreaterThanOrEqual(5000)
        expect(delay).toBeLessThanOrEqual(20000)
      }
    })
  })

  describe('typingDelay', () => {
    it('returns delay between 1-3 seconds', () => {
      for (let i = 0; i < 50; i++) {
        const delay = typingDelay()
        expect(delay).toBeGreaterThanOrEqual(1000)
        expect(delay).toBeLessThanOrEqual(3000)
      }
    })
  })

  describe('pauseDelay', () => {
    it('returns delay between 2-5 minutes', () => {
      for (let i = 0; i < 50; i++) {
        const delay = pauseDelay()
        expect(delay).toBeGreaterThanOrEqual(120000)
        expect(delay).toBeLessThanOrEqual(300000)
      }
    })
  })

  describe('isWithinSchedule', () => {
    it('returns true during business hours', () => {
      expect(isWithinSchedule(8)).toBe(true)
      expect(isWithinSchedule(12)).toBe(true)
      expect(isWithinSchedule(19)).toBe(true)
    })

    it('returns false outside business hours', () => {
      expect(isWithinSchedule(7)).toBe(false)
      expect(isWithinSchedule(20)).toBe(false)
      expect(isWithinSchedule(0)).toBe(false)
      expect(isWithinSchedule(23)).toBe(false)
    })

    it('respects custom schedule', () => {
      expect(isWithinSchedule(6, 6, 22)).toBe(true)
      expect(isWithinSchedule(23, 6, 22)).toBe(false)
    })
  })

  describe('sleep', () => {
    it('resolves after specified time', async () => {
      const start = Date.now()
      await sleep(50)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(40)
    })
  })
})
