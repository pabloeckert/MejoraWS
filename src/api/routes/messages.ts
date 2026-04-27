// src/api/routes/messages.ts
// API routes for messages

import { Router, Request, Response } from 'express'
import { MessageReceiver } from '../../whatsapp/receiver'
import { MessageSender } from '../../whatsapp/sender'
import { validate } from '../middleware/validate'
import { sendMessageSchema } from '../schemas'
import { AppError } from '../middleware/error'
import { childLogger } from '../../utils/logger'

const log = childLogger('api:messages')

export function messagesRouter(receiver: MessageReceiver, sender: MessageSender) {
  const router = Router()

  // Get message history for a contact
  router.get('/:phone', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 50
    const history = receiver.getHistory(req.params.phone as string, limit)
    res.json({ data: history })
  })

  // Get recent messages
  router.get('/recent/all', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 20
    const recent = receiver.getRecent(limit)
    res.json({ data: recent })
  })

  // Send a message
  router.post('/send', validate(sendMessageSchema), async (req: Request, res: Response) => {
    const { to, text } = req.body

    const success = await sender.send(to, text)
    if (!success) {
      throw new AppError(500, 'Failed to send message', 'SEND_FAILED')
    }

    log.info({ to }, 'Message sent via API')
    res.json({ data: { sent: true, to } })
  })

  // Get send stats
  router.get('/stats/sending', (_req: Request, res: Response) => {
    const stats = sender.getStats()
    res.json({ data: stats })
  })

  return router
}
