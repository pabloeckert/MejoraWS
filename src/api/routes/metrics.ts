// src/api/routes/metrics.ts
// Prometheus metrics endpoint

import { Router, Request, Response } from 'express'
import { metrics, httpRequests, httpErrors, uptime } from '../../utils/metrics'

const startTime = Date.now()

export function metricsRouter() {
  const router = Router()

  // GET /metrics — Prometheus text format
  router.get('/', (_req: Request, res: Response) => {
    try {
      uptime.set(Math.floor((Date.now() - startTime) / 1000))
      res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      res.send(metrics.render())
    } catch (err: any) {
      res.status(500).send(`# Error: ${err.message}\n`)
    }
  })

  return router
}

// Middleware para trackear requests HTTP
export function metricsMiddleware() {
  return (req: Request, res: Response, next: Function) => {
    const start = Date.now()

    res.on('finish', () => {
      const duration = Date.now() - start
      httpRequests.inc(1, {
        method: req.method,
        path: req.path,
        status: String(res.statusCode),
      })

      if (res.statusCode >= 400) {
        httpErrors.inc(1, {
          method: req.method,
          path: req.path,
          status: String(res.statusCode),
        })
      }
    })

    next()
  }
}
