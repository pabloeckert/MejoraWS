// src/api/middleware/rate-limit.ts
// Rate limiting per-IP y per-user (JWT)

import { Request, Response, NextFunction } from 'express'

interface RateLimitEntry {
  count: number
  resetAt: number
}

// Stores separados para IP y User
const ipStore = new Map<string, RateLimitEntry>()
const userStore = new Map<string, RateLimitEntry>()

// Cleanup every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of ipStore) {
    if (now > entry.resetAt) ipStore.delete(key)
  }
  for (const [key, entry] of userStore) {
    if (now > entry.resetAt) userStore.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * Rate limiter por IP (general)
 */
export function rateLimit(opts: { windowMs?: number; max?: number } = {}) {
  const windowMs = opts.windowMs || 60 * 1000 // 1 min
  const max = opts.max || 100

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || 'unknown'
    const now = Date.now()

    let entry = ipStore.get(key)
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      ipStore.set(key, entry)
    }

    entry.count++

    res.setHeader('X-RateLimit-Limit', String(max))
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)))
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > max) {
      res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      })
      return
    }

    next()
  }
}

/**
 * Rate limiter por usuario autenticado (JWT)
 * Más restrictivo para endpoints sensibles
 */
export function userRateLimit(opts: { windowMs?: number; max?: number } = {}) {
  const windowMs = opts.windowMs || 60 * 1000
  const max = opts.max || 30 // Más restrictivo que IP

  return (req: Request, res: Response, next: NextFunction): void => {
    // Extraer user del JWT (seteado por requireAuth middleware)
    const user = (req as any).user
    const key = user?.sub || user?.role || req.ip || 'unknown'
    const now = Date.now()

    let entry = userStore.get(key)
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      userStore.set(key, entry)
    }

    entry.count++

    res.setHeader('X-UserRateLimit-Limit', String(max))
    res.setHeader('X-UserRateLimit-Remaining', String(Math.max(0, max - entry.count)))
    res.setHeader('X-UserRateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > max) {
      res.status(429).json({
        error: 'Too many requests for this user',
        code: 'USER_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      })
      return
    }

    next()
  }
}
