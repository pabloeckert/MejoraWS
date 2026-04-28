// src/security/encryption.ts
// Cifrado at-rest para datos sensibles (sesión WhatsApp, etc.)
// Usa AES-256-GCM con key derivada de variable de entorno

import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { childLogger } from '../utils/logger'

const log = childLogger('security:encryption')

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 32

/**
 * Deriva una clave de 256 bits desde un secret usando PBKDF2
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(secret, salt, 100_000, KEY_LENGTH, 'sha512')
}

/**
 * Obtiene la clave de cifrado desde variable de entorno
 */
function getEncryptionSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) {
    // Fallback: usar JWT_SECRET como base (mejor que nada)
    const fallback = process.env.JWT_SECRET || 'mejoraws-encryption-fallback-change-in-production'
    log.warn('ENCRYPTION_SECRET not set, using JWT_SECRET as fallback')
    return fallback
  }
  return secret
}

/**
 * Cifra un buffer con AES-256-GCM
 * Formato output: [salt(32)][iv(16)][authTag(16)][ciphertext]
 */
export function encryptBuffer(plaintext: Buffer): Buffer {
  const secret = getEncryptionSecret()
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = deriveKey(secret, salt)
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()

  return Buffer.concat([salt, iv, authTag, encrypted])
}

/**
 * Descifra un buffer con AES-256-GCM
 */
export function decryptBuffer(encrypted: Buffer): Buffer {
  const secret = getEncryptionSecret()

  let offset = 0
  const salt = encrypted.subarray(offset, offset + SALT_LENGTH); offset += SALT_LENGTH
  const iv = encrypted.subarray(offset, offset + IV_LENGTH); offset += IV_LENGTH
  const authTag = encrypted.subarray(offset, offset + AUTH_TAG_LENGTH); offset += AUTH_TAG_LENGTH
  const ciphertext = encrypted.subarray(offset)

  const key = deriveKey(secret, salt)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

/**
 * Cifra un archivo in-place (sobrescribe el original)
 */
export function encryptFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return

  const plaintext = fs.readFileSync(filePath)
  if (plaintext.length === 0) return

  // Verificar si ya está cifrado (marcador: "ENC:" al inicio)
  if (plaintext.subarray(0, 4).toString() === 'ENC:') return

  const encrypted = encryptBuffer(plaintext)
  const output = Buffer.concat([Buffer.from('ENC:'), encrypted])
  fs.writeFileSync(filePath, output)
  log.debug({ filePath, size: encrypted.length }, 'File encrypted')
}

/**
 * Descifra un archivo in-place
 */
export function decryptFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return

  const data = fs.readFileSync(filePath)
  if (data.length === 0) return

  // Verificar marcador
  if (data.subarray(0, 4).toString() !== 'ENC:') return

  const encrypted = data.subarray(4)
  const plaintext = decryptBuffer(encrypted)
  fs.writeFileSync(filePath, plaintext)
  log.debug({ filePath, size: plaintext.length }, 'File decrypted')
}

/**
 * Cifra recursivamente todos los archivos de un directorio
 */
export function encryptDirectory(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0

  let count = 0
  const entries = fs.readdirSync(dirPath, { withFileTypes: true, recursive: true })

  for (const entry of entries) {
    if (!entry.isFile()) continue

    const fullPath = path.join(entry.parentPath || dirPath, entry.name)
    try {
      const data = fs.readFileSync(fullPath)
      if (data.length > 0 && data.subarray(0, 4).toString() !== 'ENC:') {
        encryptFile(fullPath)
        count++
      }
    } catch {
      // Skip files that can't be read
    }
  }

  log.info({ dirPath, filesEncrypted: count }, 'Directory encrypted')
  return count
}

/**
 * Descifra recursivamente todos los archivos de un directorio
 */
export function decryptDirectory(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0

  let count = 0
  const entries = fs.readdirSync(dirPath, { withFileTypes: true, recursive: true })

  for (const entry of entries) {
    if (!entry.isFile()) continue

    const fullPath = path.join(entry.parentPath || dirPath, entry.name)
    try {
      const data = fs.readFileSync(fullPath)
      if (data.length > 0 && data.subarray(0, 4).toString() === 'ENC:') {
        decryptFile(fullPath)
        count++
      }
    } catch {
      // Skip files that can't be read
    }
  }

  log.info({ dirPath, filesDecrypted: count }, 'Directory decrypted')
  return count
}
