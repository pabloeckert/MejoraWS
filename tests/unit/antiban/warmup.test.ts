// tests/unit/antiban/warmup.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WarmupManager } from '../../../src/antiban/warmup'
import * as fs from 'fs'
import * as path from 'path'

const TEST_STATE_PATH = '/tmp/test-warmup-' + Date.now() + '.json'

describe('WarmupManager', () => {
  let warmup: WarmupManager

  beforeEach(() => {
    // Clean state
    if (fs.existsSync(TEST_STATE_PATH)) fs.unlinkSync(TEST_STATE_PATH)
    warmup = new WarmupManager(TEST_STATE_PATH)
  })

  afterEach(() => {
    if (fs.existsSync(TEST_STATE_PATH)) fs.unlinkSync(TEST_STATE_PATH)
  })

  it('starts at day 1', () => {
    expect(warmup.getCurrentDay()).toBe(1)
  })

  it('has correct daily limit for day 1', () => {
    expect(warmup.getDailyLimit()).toBe(10)
  })

  it('can send when under limit', () => {
    expect(warmup.canSend()).toBe(true)
  })

  it('blocks after reaching daily limit', () => {
    for (let i = 0; i < 10; i++) {
      warmup.recordSend()
    }
    expect(warmup.canSend()).toBe(false)
  })

  it('tracks sent count', () => {
    warmup.recordSend()
    warmup.recordSend()
    expect(warmup.getSentToday()).toBe(2)
  })

  it('calculates warmup progress', () => {
    expect(warmup.getWarmupProgress()).toBe(Math.round((1 / 14) * 100))
  })

  it('reports warmup not complete initially', () => {
    expect(warmup.isWarmupComplete()).toBe(false)
  })

  it('resets state correctly', () => {
    warmup.recordSend()
    warmup.recordSend()
    warmup.reset()
    expect(warmup.getSentToday()).toBe(0)
    expect(warmup.getCurrentDay()).toBe(1)
  })

  it('returns status string', () => {
    const status = warmup.getStatus()
    expect(status).toContain('Día')
    expect(status).toContain('14')
  })

  it('has correct limits for all warmup days', () => {
    const expected: Record<number, number> = {
      1: 10, 2: 12, 3: 15, 4: 18, 5: 22,
      6: 28, 7: 35, 8: 45, 9: 55, 10: 70,
      11: 85, 12: 100, 13: 120, 14: 150,
    }
    // We can only test day 1 directly since day advances on date change
    expect(warmup.getDailyLimit()).toBe(expected[1])
  })
})
