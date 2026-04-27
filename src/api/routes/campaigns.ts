// src/api/routes/campaigns.ts
// API routes for campaigns

import { Router, Request, Response } from 'express'
import { CampaignEngine } from '../../campaigns/engine'
import { CampaignScheduler } from '../../campaigns/scheduler'
import { validate } from '../middleware/validate'
import { AppError } from '../middleware/error'
import { childLogger } from '../../utils/logger'
import { z } from 'zod'

const log = childLogger('api:campaigns')

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  objective: z.string().max(500).optional(),
  audience: z.string().max(500).optional(),
  template: z.string().min(1).max(4096),
  variations: z.array(z.string().max(4096)).max(10).optional(),
  scheduled_at: z.string().datetime().optional(),
})

const executeCampaignSchema = z.object({
  audience: z.string().optional(), // override audience
  phones: z.array(z.string()).optional(), // explicit phone list
})

export function campaignsRouter(engine: CampaignEngine, scheduler: CampaignScheduler) {
  const router = Router()

  // List campaigns
  router.get('/', (_req: Request, res: Response) => {
    const campaigns = engine.list()
    res.json({ data: campaigns })
  })

  // Get campaign by ID
  router.get('/:id', (req: Request, res: Response) => {
    const campaign = engine.get(req.params.id as string)
    if (!campaign) throw new AppError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND')
    res.json({ data: campaign })
  })

  // Get campaign stats
  router.get('/:id/stats', (req: Request, res: Response) => {
    const stats = engine.getStats(req.params.id as string)
    res.json({ data: stats })
  })

  // Create campaign
  router.post('/', validate(createCampaignSchema), (req: Request, res: Response) => {
    const campaign = engine.create(req.body)
    log.info({ campaignId: campaign.id, name: campaign.name }, 'Campaign created via API')
    res.status(201).json({ data: campaign })
  })

  // Update campaign
  router.patch('/:id', (req: Request, res: Response) => {
    const campaign = engine.update(req.params.id as string, req.body)
    if (!campaign) throw new AppError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND')
    log.info({ campaignId: req.params.id }, 'Campaign updated via API')
    res.json({ data: campaign })
  })

  // Delete campaign
  router.delete('/:id', (req: Request, res: Response) => {
    const deleted = engine.delete(req.params.id as string)
    if (!deleted) throw new AppError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND')
    log.info({ campaignId: req.params.id }, 'Campaign deleted via API')
    res.status(204).send()
  })

  // Execute campaign
  router.post('/:id/execute', async (req: Request, res: Response) => {
    const campaign = engine.get(req.params.id as string)
    if (!campaign) throw new AppError(404, 'Campaign not found', 'CAMPAIGN_NOT_FOUND')

    if (campaign.status === 'running') {
      throw new AppError(409, 'Campaign is already running', 'ALREADY_RUNNING')
    }

    // Resolve targets
    let targets: Array<{ phone: string; name?: string; variables?: Record<string, string> }> = []

    if (req.body.phones) {
      targets = req.body.phones.map((phone: string) => ({ phone }))
    } else {
      targets = scheduler.resolveAudience(req.body.audience || campaign.audience)
    }

    if (targets.length === 0) {
      throw new AppError(400, 'No targets found for this campaign', 'NO_TARGETS')
    }

    // Execute async
    log.info({ campaignId: campaign.id, targets: targets.length }, 'Executing campaign via API')
    engine.execute(campaign.id, targets).catch(err => {
      log.error({ err, campaignId: campaign.id }, 'Campaign execution failed')
    })

    res.json({
      data: {
        message: 'Campaign execution started',
        campaignId: campaign.id,
        targets: targets.length,
      },
    })
  })

  // Pause campaign
  router.post('/:id/pause', (req: Request, res: Response) => {
    engine.pause(req.params.id as string)
    res.json({ data: { message: 'Campaign paused' } })
  })

  return router
}
