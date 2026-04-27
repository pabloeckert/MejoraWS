// src/api/middleware/validate.ts
// Zod validation middleware

import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'

type RequestPart = 'body' | 'query' | 'params'

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[part])
      req[part] = parsed
      next()
    } catch (err) {
      if (err instanceof ZodError) {
        const issues = err.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        }))
        res.status(400).json({
          error: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: issues,
        })
        return
      }
      next(err)
    }
  }
}
