// src/api/routes/mfa.ts
// API routes for MFA management

import { Router, Request, Response } from 'express'
import { MFAManager } from '../../security/mfa'
import { AppError } from '../middleware/error'
import { childLogger } from '../../utils/logger'

const log = childLogger('api:mfa')

export function mfaRouter(manager: MFAManager) {
  const router = Router()

  // Get MFA status
  router.get('/status', (_req: Request, res: Response) => {
    const config = manager.getConfig()
    res.json({
      data: {
        enabled: config.enabled,
        // Don't expose secret or backup codes
      },
    })
  })

  // Generate MFA secret (returns QR URL)
  router.post('/setup', (_req: Request, res: Response) => {
    if (manager.isEnabled()) {
      throw new AppError(400, 'MFA is already enabled', 'MFA_ALREADY_ENABLED')
    }
    const { secret, otpauthUrl } = manager.generateSecret()
    log.info('MFA secret generated')
    res.json({ data: { secret, otpauthUrl } })
  })

  // Enable MFA (verify code and activate)
  router.post('/enable', (req: Request, res: Response) => {
    const { code } = req.body
    if (!code) throw new AppError(400, 'code is required', 'VALIDATION')

    const result = manager.enable(code)
    if (!result.success) {
      throw new AppError(400, 'Invalid code', 'MFA_INVALID_CODE')
    }

    log.info('MFA enabled')
    res.json({
      data: {
        enabled: true,
        backupCodes: result.backupCodes,
        message: 'Save these backup codes in a safe place. They can be used if you lose access to your authenticator.',
      },
    })
  })

  // Disable MFA
  router.post('/disable', (req: Request, res: Response) => {
    const { code } = req.body
    if (!code) throw new AppError(400, 'code is required', 'VALIDATION')

    const success = manager.disable(code)
    if (!success) {
      throw new AppError(400, 'Invalid code', 'MFA_INVALID_CODE')
    }

    log.info('MFA disabled')
    res.json({ data: { enabled: false } })
  })

  // Verify MFA code (used during login)
  router.post('/verify', (req: Request, res: Response) => {
    const { code } = req.body
    if (!code) throw new AppError(400, 'code is required', 'VALIDATION')

    const valid = manager.verify(code)
    if (!valid) {
      throw new AppError(401, 'Invalid code', 'MFA_INVALID_CODE')
    }

    res.json({ data: { valid: true } })
  })

  // Regenerate backup codes
  router.post('/backup-codes', (req: Request, res: Response) => {
    const { code } = req.body
    if (!code) throw new AppError(400, 'TOTP code is required', 'VALIDATION')

    const backupCodes = manager.regenerateBackupCodes(code)
    if (!backupCodes) {
      throw new AppError(400, 'Invalid code', 'MFA_INVALID_CODE')
    }

    log.info('MFA backup codes regenerated')
    res.json({ data: { backupCodes } })
  })

  return router
}
