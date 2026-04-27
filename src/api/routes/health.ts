// src/api/routes/health.ts
// Health check endpoint

import { Router, Request, Response } from 'express'
import Database from 'better-sqlite3'

export function healthRouter(db: Database.Database, llmStatus: () => Promise<any>) {
  const router = Router()
  const startTime = Date.now()

  router.get('/', async (_req: Request, res: Response) => {
    try {
      // Check DB
      db.prepare('SELECT 1').get()

      // Check LLM
      const llm = await llmStatus()

      res.json({
        status: 'ok',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: '0.1.0',
        checks: {
          database: 'ok',
          llm: llm.active || 'unavailable',
          groq: llm.groq ? 'ok' : 'unavailable',
          ollama: llm.ollama ? 'ok' : 'unavailable',
        },
      })
    } catch (err: any) {
      res.status(503).json({
        status: 'degraded',
        error: err.message,
      })
    }
  })

  return router
}
