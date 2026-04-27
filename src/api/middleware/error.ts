// src/api/middleware/error.ts
// Global error handling middleware

import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { logger } from '../../utils/logger'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Zod validation error
  if (err instanceof ZodError) {
    const issues = err.issues.map(i => ({
      path: i.path.join('.'),
      message: i.message,
    }))
    res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: issues,
    })
    return
  }

  // App error (known)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code || 'APP_ERROR',
    })
    return
  }

  // Unknown error
  logger.error({ err, path: req.path }, 'Unhandled error')
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  })
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.path}`,
    code: 'NOT_FOUND',
  })
}
