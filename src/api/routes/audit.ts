// src/api/routes/audit.ts
// Audit log API routes

import { Router, Request, Response } from 'express'
import { AuditLogger, AuditAction } from '../../security/audit'
import { DataRetention } from '../../security/retention'

export function auditRouter(audit: AuditLogger, retention: DataRetention) {
  const router = Router()

  // Get audit log entries
  router.get('/', (req: Request, res: Response) => {
    const { action, entity_type, entity_id, limit, offset, from, to } = req.query as any

    const entries = audit.getEntries({
      action,
      entity_type,
      entity_id,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
      from,
      to,
    })

    res.json({ data: entries, total: audit.count({ action }) })
  })

  // Get audit stats
  router.get('/stats', (_req: Request, res: Response) => {
    const dataStats = retention.getStats()
    const policy = retention.getPolicy()
    res.json({ data: { storage: dataStats, retentionPolicy: policy } })
  })

  // Trigger retention cleanup
  router.post('/cleanup', (_req: Request, res: Response) => {
    const result = retention.runCleanup()
    res.json({ data: result })
  })

  // Update retention policy
  router.put('/retention', (req: Request, res: Response) => {
    retention.updatePolicy(req.body)
    res.json({ data: retention.getPolicy() })
  })

  return router
}
