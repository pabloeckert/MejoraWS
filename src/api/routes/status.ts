// src/api/routes/status.ts
// API routes for system status and bot config

import { Router, Request, Response } from 'express'
import { Orchestrator } from '../../brain/orchestrator'
import { AutoReplyEngine } from '../../brain/auto-reply'
import { getAvailableTemplates } from '../../brain/prompt-templates'
import { childLogger } from '../../utils/logger'

const log = childLogger('api:status')

export function statusRouter(orchestrator: Orchestrator) {
  const router = Router()

  // System status
  router.get('/', async (_req: Request, res: Response) => {
    const sysStatus = await orchestrator.getStatus()
    const sendStats = orchestrator.getSendStats()
    const contactStats = orchestrator.contacts.getStats()
    const dealStats = orchestrator.deals.getStats()

    res.json({
      data: {
        system: sysStatus,
        send: sendStats,
        contacts: contactStats,
        deals: dealStats,
      },
    })
  })

  // Bot config
  router.get('/config', (_req: Request, res: Response) => {
    const config = orchestrator.getAutoReply().getConfig()
    res.json({ data: config })
  })

  // Update bot config
  router.put('/config', (req: Request, res: Response) => {
    orchestrator.updateBotConfig(req.body)
    const config = orchestrator.getAutoReply().getConfig()
    log.info('Bot config updated via API')
    res.json({ data: config })
  })

  // Get available industry templates
  router.get('/templates', (_req: Request, res: Response) => {
    const templates = getAvailableTemplates()
    res.json({ data: templates })
  })

  // Update knowledge base
  router.put('/kb', (req: Request, res: Response) => {
    const { knowledge } = req.body
    if (!knowledge || typeof knowledge !== 'string') {
      res.status(400).json({ error: 'knowledge (string) is required' })
      return
    }
    orchestrator.setKnowledgeBase(knowledge)
    log.info('Knowledge base updated via API')
    res.json({ data: { updated: true } })
  })

  return router
}
