// tests/unit/security/breach.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { BreachManager } from '../../../src/security/breach'

describe('BreachManager', () => {
  let db: Database.Database
  let breach: BreachManager
  let dbPath: string

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-breach-${Date.now()}.db`)
    db = new Database(dbPath)
    db.exec('PRAGMA journal_mode=WAL')
    breach = new BreachManager(db)
  })

  afterEach(() => {
    db.close()
    try { fs.unlinkSync(dbPath) } catch {}
    try { fs.unlinkSync(dbPath + '-wal') } catch {}
    try { fs.unlinkSync(dbPath + '-shm') } catch {}
  })

  describe('report', () => {
    it('should create a breach incident', () => {
      const incident = breach.report({
        title: 'Test breach',
        description: 'Unauthorized access detected',
        severity: 'high',
        affected_records: 100,
        data_types: ['phone', 'name'],
        detection_source: 'audit_log',
      })

      expect(incident.id).toBeDefined()
      expect(incident.title).toBe('Test breach')
      expect(incident.severity).toBe('high')
      expect(incident.status).toBe('detected')
      expect(incident.affected_records).toBe(100)
      expect(incident.authority_notified).toBeFalsy()
      expect(incident.subjects_notified).toBeFalsy()
    })
  })

  describe('update', () => {
    it('should update breach status', () => {
      const incident = breach.report({
        title: 'Test',
        description: 'Desc',
        severity: 'medium',
        affected_records: 10,
        data_types: ['email'],
        detection_source: 'manual',
      })

      breach.update(incident.id, { status: 'investigating' })
      const updated = breach.getById(incident.id)
      expect(updated?.status).toBe('investigating')
    })
  })

  describe('markContained', () => {
    it('should mark incident as contained', () => {
      const incident = breach.report({
        title: 'Test',
        description: 'Desc',
        severity: 'high',
        affected_records: 50,
        data_types: ['phone'],
        detection_source: 'manual',
      })

      breach.markContained(incident.id)
      const updated = breach.getById(incident.id)
      expect(updated?.status).toBe('contained')
      expect(updated?.containment_date).toBeDefined()
    })
  })

  describe('markResolved', () => {
    it('should mark incident as resolved', () => {
      const incident = breach.report({
        title: 'Test',
        description: 'Desc',
        severity: 'critical',
        affected_records: 200,
        data_types: ['phone', 'messages'],
        detection_source: 'monitoring',
      })

      breach.markResolved(incident.id, 'Patched vulnerability, rotated keys')
      const updated = breach.getById(incident.id)
      expect(updated?.status).toBe('resolved')
      expect(updated?.resolution_date).toBeDefined()
      expect(updated?.corrective_actions).toBe('Patched vulnerability, rotated keys')
    })
  })

  describe('notifyAuthority', () => {
    it('should register authority notification', () => {
      const incident = breach.report({
        title: 'GDPR breach',
        description: 'Data exposed',
        severity: 'high',
        affected_records: 500,
        data_types: ['phone', 'email'],
        detection_source: 'audit',
      })

      breach.notifyAuthority(incident.id)
      const updated = breach.getById(incident.id)
      expect(updated?.authority_notified).toBeTruthy()
      expect(updated?.authority_notification_date).toBeDefined()
    })
  })

  describe('notifySubjects', () => {
    it('should register subject notification', () => {
      const incident = breach.report({
        title: 'Breach',
        description: 'Desc',
        severity: 'high',
        affected_records: 100,
        data_types: ['phone'],
        detection_source: 'manual',
      })

      breach.notifySubjects(incident.id)
      const updated = breach.getById(incident.id)
      expect(updated?.subjects_notified).toBeTruthy()
      expect(updated?.subjects_notification_date).toBeDefined()
    })
  })

  describe('list', () => {
    it('should list all incidents', () => {
      breach.report({ title: 'A', description: 'D', severity: 'low', affected_records: 1, data_types: [], detection_source: 'm' })
      breach.report({ title: 'B', description: 'D', severity: 'high', affected_records: 2, data_types: [], detection_source: 'm' })

      const list = breach.list()
      expect(list.length).toBe(2)
    })

    it('should filter by severity', () => {
      breach.report({ title: 'Low', description: 'D', severity: 'low', affected_records: 1, data_types: [], detection_source: 'm' })
      breach.report({ title: 'High', description: 'D', severity: 'high', affected_records: 2, data_types: [], detection_source: 'm' })

      const high = breach.list({ severity: 'high' })
      expect(high.length).toBe(1)
      expect(high[0].title).toBe('High')
    })
  })

  describe('getStats', () => {
    it('should return breach statistics', () => {
      breach.report({ title: 'A', description: 'D', severity: 'low', affected_records: 1, data_types: [], detection_source: 'm' })
      const b = breach.report({ title: 'B', description: 'D', severity: 'critical', affected_records: 100, data_types: [], detection_source: 'm' })
      breach.markResolved(b.id, 'Fixed')

      const stats = breach.getStats()
      expect(stats.total).toBe(2)
      expect(stats.open).toBe(1)
      expect(stats.resolved).toBe(1)
      expect(stats.critical).toBe(0) // resolved, so not counted as open critical
    })
  })

  describe('getOverdueNotifications', () => {
    it('should return empty when no overdue', () => {
      breach.report({ title: 'Recent', description: 'D', severity: 'high', affected_records: 1, data_types: [], detection_source: 'm' })
      const overdue = breach.getOverdueNotifications()
      expect(overdue.length).toBe(0)
    })
  })
})
