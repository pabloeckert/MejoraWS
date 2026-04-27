// src/api/index.ts
// API Express app — mounts all routes

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { Orchestrator } from '../brain/orchestrator'
import { errorHandler, notFoundHandler } from './middleware/error'
import { rateLimit } from './middleware/rate-limit'
import { healthRouter } from './routes/health'
import { contactsRouter } from './routes/contacts'
import { dealsRouter } from './routes/deals'
import { messagesRouter } from './routes/messages'
import { statusRouter } from './routes/status'
import { authRouter } from './routes/auth'
import { campaignsRouter } from './routes/campaigns'
import { childLogger } from '../utils/logger'

const log = childLogger('api')

export function createApi(orchestrator: Orchestrator): express.Application {
  const app = express()

  // === MIDDLEWARE ===
  app.use(helmet())
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))
  app.use(express.json({ limit: '1mb' }))
  app.use(rateLimit({ windowMs: 60_000, max: 200 }))

  // Request logging
  app.use((req, _res, next) => {
    log.debug({ method: req.method, path: req.path }, 'Request')
    next()
  })

  // === ROUTES ===
  app.use('/health', healthRouter(
    orchestrator.getDB(),
    () => orchestrator.getStatus().then(s => s.llm),
  ))

  app.use('/api/v1/auth', authRouter())
  app.use('/api/v1/contacts', contactsRouter(orchestrator.contacts, orchestrator.importer))
  app.use('/api/v1/deals', dealsRouter(orchestrator.deals))
  app.use('/api/v1/messages', messagesRouter(
    orchestrator.getReceiver(),
    { send: (to: string, text: string) => orchestrator.sendMessage(to, text), getStats: () => orchestrator.getSendStats() } as any,
  ))
  app.use('/api/v1/status', statusRouter(orchestrator))
  app.use('/api/v1/campaigns', campaignsRouter(orchestrator.campaigns, orchestrator.campaignScheduler))

  // === ERROR HANDLING ===
  app.use(notFoundHandler)
  app.use(errorHandler)

  log.info('API initialized')
  return app
}
