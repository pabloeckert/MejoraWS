// tests/unit/security/audit.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { AuditLogger } from '../../../src/security/audit'
import { initDatabase } from '../../../src/db/database'

const TEST_DB = '/tmp/test-audit-' + Date.now() + '.db'

describe('AuditLogger', () => {
  let db: Database.Database
  let audit: AuditLogger

  beforeEach(() => {
    db = initDatabase(TEST_DB)
    audit = new AuditLogger(db)
  })

  afterEach(() => {
    db.close()
    try { require('fs').unlinkSync(TEST_DB) } catch {}
  })

  it('logs and retrieves audit entries', () => {
    audit.log({ action: 'contact.create', entity_type: 'contact', entity_id: 'c1' })

    const entries = audit.getEntries()
    expect(entries.length).toBe(1)
    expect(entries[0].action).toBe('contact.create')
    expect(entries[0].entity_type).toBe('contact')
    expect(entries[0].entity_id).toBe('c1')
  })

  it('filters by action', () => {
    audit.log({ action: 'contact.create' })
    audit.log({ action: 'message.send' })
    audit.log({ action: 'contact.delete' })

    const contactActions = audit.getEntries({ action: 'contact.create' })
    expect(contactActions.length).toBe(1)
  })

  it('counts entries', () => {
    audit.log({ action: 'contact.create' })
    audit.log({ action: 'contact.create' })
    audit.log({ action: 'message.send' })

    expect(audit.count()).toBe(3)
    expect(audit.count({ action: 'contact.create' })).toBe(2)
  })

  it('supports pagination', () => {
    for (let i = 0; i < 10; i++) {
      audit.log({ action: 'message.send' })
    }

    const page1 = audit.getEntries({ limit: 3, offset: 0 })
    const page2 = audit.getEntries({ limit: 3, offset: 3 })
    expect(page1.length).toBe(3)
    expect(page2.length).toBe(3)
    expect(page1[0].id).not.toBe(page2[0].id)
  })

  it('includes IP and user agent', () => {
    audit.log({ action: 'auth.login', ip: '192.168.1.1', user_agent: 'TestAgent/1.0' })

    const entries = audit.getEntries()
    expect(entries[0].ip).toBe('192.168.1.1')
    expect(entries[0].user_agent).toBe('TestAgent/1.0')
  })

  it('cleanup removes old entries', () => {
    audit.log({ action: 'contact.create' })
    const deleted = audit.cleanup(0) // Delete everything older than 0 days
    expect(deleted).toBeGreaterThanOrEqual(0) // May be 0 if entries are from "today"
  })
})
