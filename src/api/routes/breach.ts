// src/api/routes/breach.ts
// Breach notification API endpoints (GDPR Art. 33/34)

import { Router, Request, Response } from 'express'
import { BreachManager } from '../../security/breach'
import { AppError } from '../middleware/error'
import { childLogger } from '../../utils/logger'

const log = childLogger('api:breach')

export function breachRouter(breachManager: BreachManager) {
  const router = Router()

  /**
   * POST /api/v1/breach/report
   * Reportar una nueva brecha de datos
   */
  router.post('/report', (req: Request, res: Response) => {
    const { title, description, severity, affected_records, data_types, detection_source } = req.body

    if (!title || !description) {
      throw new AppError(400, 'title and description are required', 'VALIDATION_ERROR')
    }

    const incident = breachManager.report({
      title,
      description,
      severity: severity || 'medium',
      affected_records: affected_records || 0,
      data_types: data_types || [],
      detection_source: detection_source || 'manual',
    })

    log.fatal({ id: incident.id, severity: incident.severity }, 'New breach reported via API')

    res.status(201).json({ data: incident })
  })

  /**
   * GET /api/v1/breach
   * Listar brechas
   */
  router.get('/', (req: Request, res: Response) => {
    const incidents = breachManager.list({
      status: req.query.status as any,
      severity: req.query.severity as any,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    })

    res.json({ data: incidents })
  })

  /**
   * GET /api/v1/breach/stats
   * Estadísticas de brechas
   */
  router.get('/stats', (_req: Request, res: Response) => {
    const stats = breachManager.getStats()
    res.json({ data: stats })
  })

  /**
   * GET /api/v1/breach/overdue
   * Brechas pendientes de notificación (>72h)
   */
  router.get('/overdue', (_req: Request, res: Response) => {
    const overdue = breachManager.getOverdueNotifications()
    res.json({
      data: overdue,
      warning: overdue.length > 0 ? 'Some breaches exceed the 72h notification deadline (GDPR Art. 33)' : null,
    })
  })

  /**
   * GET /api/v1/breach/:id
   * Obtener brecha por ID
   */
  router.get('/:id', (req: Request, res: Response) => {
    const incident = breachManager.getById(req.params.id as string)
    if (!incident) throw new AppError(404, 'Breach incident not found', 'NOT_FOUND')
    res.json({ data: incident })
  })

  /**
   * PATCH /api/v1/breach/:id
   * Actualizar estado de brecha
   */
  router.patch('/:id', (req: Request, res: Response) => {
    const id = req.params.id as string
    const incident = breachManager.getById(id)
    if (!incident) throw new AppError(404, 'Breach incident not found', 'NOT_FOUND')

    breachManager.update(id, req.body)
    const updated = breachManager.getById(id)

    res.json({ data: updated })
  })

  /**
   * POST /api/v1/breach/:id/contain
   * Marcar brecha como contenida
   */
  router.post('/:id/contain', (req: Request, res: Response) => {
    const id = req.params.id as string
    const incident = breachManager.getById(id)
    if (!incident) throw new AppError(404, 'Breach incident not found', 'NOT_FOUND')

    breachManager.markContained(id)
    res.json({ data: breachManager.getById(id) })
  })

  /**
   * POST /api/v1/breach/:id/resolve
   * Marcar brecha como resuelta
   */
  router.post('/:id/resolve', (req: Request, res: Response) => {
    const id = req.params.id as string
    const { corrective_actions } = req.body
    const incident = breachManager.getById(id)
    if (!incident) throw new AppError(404, 'Breach incident not found', 'NOT_FOUND')

    breachManager.markResolved(id, corrective_actions || '')
    res.json({ data: breachManager.getById(id) })
  })

  /**
   * POST /api/v1/breach/:id/notify-authority
   * Registrar notificación a autoridad (GDPR Art. 33)
   */
  router.post('/:id/notify-authority', (req: Request, res: Response) => {
    const id = req.params.id as string
    const incident = breachManager.getById(id)
    if (!incident) throw new AppError(404, 'Breach incident not found', 'NOT_FOUND')

    breachManager.notifyAuthority(id)
    log.info({ id }, 'Authority notification registered')
    res.json({ data: breachManager.getById(id) })
  })

  /**
   * POST /api/v1/breach/:id/notify-subjects
   * Registrar notificación a afectados (GDPR Art. 34)
   */
  router.post('/:id/notify-subjects', (req: Request, res: Response) => {
    const id = req.params.id as string
    const incident = breachManager.getById(id)
    if (!incident) throw new AppError(404, 'Breach incident not found', 'NOT_FOUND')

    breachManager.notifySubjects(id)
    log.info({ id }, 'Data subjects notification registered')
    res.json({ data: breachManager.getById(id) })
  })

  return router
}
