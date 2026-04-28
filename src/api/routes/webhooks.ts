// src/api/routes/webhooks.ts
// API routes for webhook management

import { Router, Request, Response } from 'express'
import { WebhookManager, WebhookEvent } from '../../integrations/webhooks'
import { AppError } from '../middleware/error'
import { childLogger } from '../../utils/logger'

const log = childLogger('api:webhooks')

const VALID_EVENTS: WebhookEvent[] = [
  'message.received', 'message.sent', 'contact.created', 'contact.updated',
  'deal.created', 'deal.stage_changed', 'deal.closed',
  'campaign.completed', 'bot.escalated',
]

export function webhooksRouter(manager: WebhookManager) {
  const router = Router()

  // List webhooks
  router.get('/', (_req: Request, res: Response) => {
    const webhooks = manager.list()
    res.json({ data: webhooks })
  })

  // Create webhook
  router.post('/', (req: Request, res: Response) => {
    const { url, events, secret } = req.body
    if (!url || typeof url !== 'string') throw new AppError(400, 'url is required', 'VALIDATION')
    if (!Array.isArray(events) || events.length === 0) throw new AppError(400, 'events array is required', 'VALIDATION')

    // Validate events
    const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e as WebhookEvent))
    if (invalidEvents.length > 0) {
      throw new AppError(400, `Invalid events: ${invalidEvents.join(', ')}. Valid: ${VALID_EVENTS.join(', ')}`, 'VALIDATION')
    }

    const webhook = manager.create(url, events as WebhookEvent[], secret)
    log.info({ webhookId: webhook.id, url, events }, 'Webhook created')
    res.status(201).json({ data: webhook })
  })

  // Get webhook
  router.get('/:id', (req: Request, res: Response) => {
    const webhook = manager.get(req.params.id as string)
    if (!webhook) throw new AppError(404, 'Webhook not found', 'NOT_FOUND')
    res.json({ data: webhook })
  })

  // Update webhook
  router.patch('/:id', (req: Request, res: Response) => {
    const { url, events, active, secret } = req.body
    const updateData: any = {}
    if (url !== undefined) updateData.url = url
    if (events !== undefined) {
      const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e as WebhookEvent))
      if (invalidEvents.length > 0) {
        throw new AppError(400, `Invalid events: ${invalidEvents.join(', ')}`, 'VALIDATION')
      }
      updateData.events = events
    }
    if (active !== undefined) updateData.active = active
    if (secret !== undefined) updateData.secret = secret

    const webhook = manager.update(req.params.id as string, updateData)
    if (!webhook) throw new AppError(404, 'Webhook not found', 'NOT_FOUND')
    log.info({ webhookId: webhook.id }, 'Webhook updated')
    res.json({ data: webhook })
  })

  // Delete webhook
  router.delete('/:id', (req: Request, res: Response) => {
    const deleted = manager.delete(req.params.id as string)
    if (!deleted) throw new AppError(404, 'Webhook not found', 'NOT_FOUND')
    log.info({ webhookId: req.params.id }, 'Webhook deleted')
    res.status(204).send()
  })

  // Get delivery history
  router.get('/:id/deliveries', (req: Request, res: Response) => {
    const webhook = manager.get(req.params.id as string)
    if (!webhook) throw new AppError(404, 'Webhook not found', 'NOT_FOUND')
    const limit = parseInt(req.query.limit as string) || 20
    const deliveries = manager.getDeliveries(req.params.id as string, limit)
    res.json({ data: deliveries })
  })

  // Retry failed deliveries
  router.post('/retry-failed', async (_req: Request, res: Response) => {
    const retried = await manager.retryFailed()
    res.json({ data: { retried } })
  })

  // Get available event types
  router.get('/meta/events', (_req: Request, res: Response) => {
    res.json({ data: VALID_EVENTS })
  })

  return router
}
