// src/security/mfa.ts
// Multi-Factor Authentication for admin — TOTP (Google Authenticator compatible)
// Zero-cost: uses crypto module, no external dependencies

import { createHash, randomBytes } from 'crypto'
import Database, { Database as DatabaseType } from 'better-sqlite3'

/**
 * Generate a random base32 secret for TOTP
 */
function generateSecret(length: number = 20): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bytes = randomBytes(length)
  let secret = ''
  for (let i = 0; i < length; i++) {
    secret += chars[bytes[i] % 32]
  }
  return secret
}

/**
 * Generate TOTP code for a given time and secret
 */
function generateTOTP(secret: string, time: number = Math.floor(Date.now() / 30000)): string {
  // Decode base32 secret
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of secret.toUpperCase()) {
    const val = chars.indexOf(c)
    if (val === -1) continue
    bits += val.toString(2).padStart(5, '0')
  }

  // Convert to bytes
  const bytes = Buffer.alloc(Math.ceil(bits.length / 8))
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  }

  // HMAC-SHA1
  const crypto = require('crypto')
  const timeBuffer = Buffer.alloc(8)
  timeBuffer.writeUInt32BE(0, 0)
  timeBuffer.writeUInt32BE(time, 4)
  const hmac = crypto.createHmac('sha1', bytes).update(timeBuffer).digest()

  // Dynamic truncation
  const offset = hmac[hmac.length - 1] & 0x0f
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000

  return code.toString().padStart(6, '0')
}

/**
 * Verify a TOTP code (with ±1 window for clock skew)
 */
function verifyTOTP(secret: string, code: string): boolean {
  const currentTime = Math.floor(Date.now() / 30000)
  // Check current time and ±1 window (90 seconds tolerance)
  for (let i = -1; i <= 1; i++) {
    if (generateTOTP(secret, currentTime + i) === code) {
      return true
    }
  }
  return false
}

export interface MFAConfig {
  enabled: boolean
  secret: string | null
  backupCodes: string[]
}

export class MFAManager {
  private db: DatabaseType

  constructor(db: DatabaseType) {
    this.db = db
    this.ensureTable()
  }

  private ensureTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mfa_config (
        id TEXT PRIMARY KEY DEFAULT 'admin',
        enabled INTEGER DEFAULT 0,
        secret TEXT,
        backup_codes TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `)
  }

  /**
   * Get current MFA config
   */
  getConfig(): MFAConfig {
    let row = this.db.prepare('SELECT * FROM mfa_config WHERE id = ?').get('admin') as any
    if (!row) {
      this.db.prepare('INSERT INTO mfa_config (id) VALUES (?)').run('admin')
      row = this.db.prepare('SELECT * FROM mfa_config WHERE id = ?').get('admin') as any
    }
    return {
      enabled: !!row.enabled,
      secret: row.secret,
      backupCodes: JSON.parse(row.backup_codes || '[]'),
    }
  }

  /**
   * Generate new MFA secret (returns secret + QR URL)
   */
  generateSecret(): { secret: string; otpauthUrl: string } {
    const secret = generateSecret()
    const otpauthUrl = `otpauth://totp/MejoraWS:admin?secret=${secret}&issuer=MejoraWS&algorithm=SHA1&digits=6&period=30`

    // Store secret (not yet enabled)
    this.db.prepare(`
      UPDATE mfa_config SET secret = ?, updated_at = datetime('now') WHERE id = 'admin'
    `).run(secret)

    return { secret, otpauthUrl }
  }

  /**
   * Enable MFA (after verifying a code)
   */
  enable(code: string): { success: boolean; backupCodes?: string[] } {
    const config = this.getConfig()
    if (!config.secret) return { success: false }

    if (!verifyTOTP(config.secret, code)) {
      return { success: false }
    }

    // Generate backup codes
    const backupCodes: string[] = []
    for (let i = 0; i < 8; i++) {
      backupCodes.push(randomBytes(4).toString('hex').toUpperCase())
    }

    this.db.prepare(`
      UPDATE mfa_config SET enabled = 1, backup_codes = ?, updated_at = datetime('now') WHERE id = 'admin'
    `).run(JSON.stringify(backupCodes))

    return { success: true, backupCodes }
  }

  /**
   * Disable MFA (requires valid code or backup code)
   */
  disable(code: string): boolean {
    const config = this.getConfig()
    if (!config.enabled) return true

    // Check TOTP code
    if (config.secret && verifyTOTP(config.secret, code)) {
      this.db.prepare(`
        UPDATE mfa_config SET enabled = 0, secret = NULL, backup_codes = '[]', updated_at = datetime('now') WHERE id = 'admin'
      `).run()
      return true
    }

    // Check backup code
    const backupIndex = config.backupCodes.indexOf(code.toUpperCase())
    if (backupIndex !== -1) {
      config.backupCodes.splice(backupIndex, 1)
      this.db.prepare(`
        UPDATE mfa_config SET enabled = 0, secret = NULL, backup_codes = ?, updated_at = datetime('now') WHERE id = 'admin'
      `).run(JSON.stringify(config.backupCodes))
      return true
    }

    return false
  }

  /**
   * Verify a code (TOTP or backup)
   */
  verify(code: string): boolean {
    const config = this.getConfig()
    if (!config.enabled || !config.secret) return true // MFA not enabled = always valid

    // Check TOTP
    if (verifyTOTP(config.secret, code)) return true

    // Check backup code
    if (config.backupCodes.includes(code.toUpperCase())) {
      // Remove used backup code
      const newCodes = config.backupCodes.filter(c => c !== code.toUpperCase())
      this.db.prepare(`
        UPDATE mfa_config SET backup_codes = ?, updated_at = datetime('now') WHERE id = 'admin'
      `).run(JSON.stringify(newCodes))
      return true
    }

    return false
  }

  /**
   * Check if MFA is enabled
   */
  isEnabled(): boolean {
    return this.getConfig().enabled
  }

  /**
   * Regenerate backup codes (requires valid TOTP code)
   */
  regenerateBackupCodes(code: string): string[] | null {
    const config = this.getConfig()
    if (!config.enabled || !config.secret) return null
    if (!verifyTOTP(config.secret, code)) return null

    const backupCodes: string[] = []
    for (let i = 0; i < 8; i++) {
      backupCodes.push(randomBytes(4).toString('hex').toUpperCase())
    }

    this.db.prepare(`
      UPDATE mfa_config SET backup_codes = ?, updated_at = datetime('now') WHERE id = 'admin'
    `).run(JSON.stringify(backupCodes))

    return backupCodes
  }
}
