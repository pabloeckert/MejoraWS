// src/api/routes/auth.ts
// Simple JWT auth for dashboard

import { Router, Request, Response } from 'express'
import { AppError } from '../middleware/error'
import { childLogger } from '../../utils/logger'

const log = childLogger('api:auth')

// Simple JWT implementation (no external deps)
function base64url(data: string): string {
  return Buffer.from(data).toString('base64url')
}

function createToken(payload: any, secret: string, expiresInMs: number): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + Math.floor(expiresInMs / 1000) }))

  const crypto = require('crypto')
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url')

  return `${header}.${body}.${signature}`
}

function verifyToken(token: string, secret: string): any {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid token')

  const crypto = require('crypto')
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64url')

  if (parts[2] !== expectedSig) throw new Error('Invalid signature')

  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }

  return payload
}

export function authRouter() {
  const router = Router()
  const JWT_SECRET = process.env.JWT_SECRET || 'mejoraws-default-secret-change-in-production'
  const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'admin'
  const TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

  // Login
  router.post('/login', (req: Request, res: Response) => {
    const { password } = req.body

    if (!password || password !== DASHBOARD_PASSWORD) {
      throw new AppError(401, 'Invalid password', 'INVALID_PASSWORD')
    }

    const token = createToken({ role: 'admin' }, JWT_SECRET, TOKEN_EXPIRY)
    log.info('Dashboard login successful')

    res.json({ token })
  })

  // Verify token
  router.get('/verify', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'No token provided', 'NO_TOKEN')
    }

    try {
      const payload = verifyToken(authHeader.slice(7), JWT_SECRET)
      res.json({ valid: true, payload })
    } catch (err: any) {
      throw new AppError(401, 'Invalid token', 'INVALID_TOKEN')
    }
  })

  return router
}

// Middleware for protecting routes
export function requireAuth(req: Request, res: Response, next: Function): void {
  const JWT_SECRET = process.env.JWT_SECRET || 'mejoraws-default-secret-change-in-production'
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided', code: 'NO_TOKEN' })
    return
  }

  try {
    const payload = verifyToken(authHeader.slice(7), JWT_SECRET)
    ;(req as any).user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' })
  }
}
