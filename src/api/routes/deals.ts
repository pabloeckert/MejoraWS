// src/api/routes/deals.ts
// API routes for deals/pipeline

import { Router, Request, Response } from 'express'
import { DealManager } from '../../crm/deals'
import { validate } from '../middleware/validate'
import { createDealSchema, moveDealSchema, updateDealSchema } from '../schemas'
import { AppError } from '../middleware/error'
import { childLogger } from '../../utils/logger'

const log = childLogger('api:deals')

export function dealsRouter(deals: DealManager) {
  const router = Router()

  // List deals
  router.get('/', (req: Request, res: Response) => {
    const { stage, contact_phone, limit } = req.query as any
    const filter: any = {}
    if (stage) filter.stage = stage
    if (contact_phone) filter.contactPhone = contact_phone
    if (limit) filter.limit = parseInt(limit)

    const results = deals.list(filter)
    res.json({ data: results })
  })

  // Get pipeline view
  router.get('/pipeline', (_req: Request, res: Response) => {
    const pipeline = deals.getPipeline()
    res.json({ data: pipeline })
  })

  // Get pending follow-ups
  router.get('/followups', (_req: Request, res: Response) => {
    const followups = deals.getPendingFollowUps()
    res.json({ data: followups })
  })

  // Get deal stats
  router.get('/stats', (_req: Request, res: Response) => {
    const stats = deals.getStats()
    res.json({ data: stats })
  })

  // Get deal by ID
  router.get('/:id', (req: Request, res: Response) => {
    const deal = deals.get(req.params.id as string)
    if (!deal) throw new AppError(404, 'Deal not found', 'DEAL_NOT_FOUND')
    res.json({ data: deal })
  })

  // Create deal
  router.post('/', validate(createDealSchema), (req: Request, res: Response) => {
    const { contact_phone, value, notes } = req.body
    const deal = deals.create(contact_phone, value, notes)
    log.info({ dealId: deal.id, contact: contact_phone }, 'Deal created')
    res.status(201).json({ data: deal })
  })

  // Move deal stage
  router.patch('/:id/stage', validate(moveDealSchema), (req: Request, res: Response) => {
    try {
      const deal = deals.moveStage(req.params.id as string, req.body.stage)
      if (!deal) throw new AppError(404, 'Deal not found', 'DEAL_NOT_FOUND')
      log.info({ dealId: req.params.id as string, stage: req.body.stage }, 'Deal stage moved')
      res.json({ data: deal })
    } catch (err: any) {
      if (err.message.includes('Etapa inválida')) {
        throw new AppError(400, err.message, 'INVALID_STAGE')
      }
      throw err
    }
  })

  // Update deal
  router.patch('/:id', validate(updateDealSchema), (req: Request, res: Response) => {
    const deal = deals.update(req.params.id as string, req.body)
    if (!deal) throw new AppError(404, 'Deal not found', 'DEAL_NOT_FOUND')
    log.info({ dealId: req.params.id as string }, 'Deal updated')
    res.json({ data: deal })
  })

  // Close deal
  router.post('/:id/close', (req: Request, res: Response) => {
    const won = req.body.won === true
    const deal = deals.close(req.params.id as string, won)
    if (!deal) throw new AppError(404, 'Deal not found', 'DEAL_NOT_FOUND')
    log.info({ dealId: req.params.id as string, won }, 'Deal closed')
    res.json({ data: deal })
  })

  // Schedule follow-up
  router.post('/:id/followup', (req: Request, res: Response) => {
    const { hours } = req.body
    if (!hours || typeof hours !== 'number') {
      throw new AppError(400, 'hours is required (number)', 'MISSING_HOURS')
    }
    deals.scheduleFollowUp(req.params.id as string, hours)
    log.info({ dealId: req.params.id as string, hours }, 'Follow-up scheduled')
    res.json({ data: { message: `Follow-up scheduled in ${hours} hours` } })
  })

  return router
}
