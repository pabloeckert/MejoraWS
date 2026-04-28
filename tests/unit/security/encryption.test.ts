// tests/unit/security/encryption.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  encryptBuffer,
  decryptBuffer,
  encryptFile,
  decryptFile,
  encryptDirectory,
  decryptDirectory,
} from '../../../src/security/encryption'

describe('Encryption', () => {
  let tmpDir: string

  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = 'test-secret-for-encryption-1234'
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enc-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    delete process.env.ENCRYPTION_SECRET
  })

  describe('encryptBuffer / decryptBuffer', () => {
    it('should encrypt and decrypt buffer correctly', () => {
      const original = Buffer.from('Hello, World! This is a test message.')
      const encrypted = encryptBuffer(original)

      // Encrypted should be different from original
      expect(encrypted).not.toEqual(original)
      // Encrypted should be larger (salt + iv + authTag + ciphertext)
      expect(encrypted.length).toBeGreaterThan(original.length)

      const decrypted = decryptBuffer(encrypted)
      expect(decrypted).toEqual(original)
    })

    it('should produce different ciphertext for same input (random salt/iv)', () => {
      const original = Buffer.from('Same input')
      const enc1 = encryptBuffer(original)
      const enc2 = encryptBuffer(original)

      // Different due to random salt and IV
      expect(enc1).not.toEqual(enc2)

      // But both should decrypt to same value
      expect(decryptBuffer(enc1)).toEqual(original)
      expect(decryptBuffer(enc2)).toEqual(original)
    })

    it('should handle empty buffer', () => {
      const original = Buffer.alloc(0)
      const encrypted = encryptBuffer(original)
      const decrypted = decryptBuffer(encrypted)
      expect(decrypted).toEqual(original)
    })

    it('should handle large buffers', () => {
      const original = Buffer.alloc(100_000, 0xAB)
      const encrypted = encryptBuffer(original)
      const decrypted = decryptBuffer(encrypted)
      expect(decrypted).toEqual(original)
    })

    it('should fail to decrypt with wrong key', () => {
      const original = Buffer.from('Secret data')
      const encrypted = encryptBuffer(original)

      process.env.ENCRYPTION_SECRET = 'wrong-secret'
      expect(() => decryptBuffer(encrypted)).toThrow()
    })
  })

  describe('encryptFile / decryptFile', () => {
    it('should encrypt and decrypt file in-place', () => {
      const filePath = path.join(tmpDir, 'test.txt')
      const content = 'This is file content for testing encryption'
      fs.writeFileSync(filePath, content)

      encryptFile(filePath)
      // File should be different after encryption
      const encrypted = fs.readFileSync(filePath)
      expect(encrypted.toString()).not.toBe(content)
      // Should have ENC: marker
      expect(encrypted.subarray(0, 4).toString()).toBe('ENC:')

      decryptFile(filePath)
      const decrypted = fs.readFileSync(filePath).toString()
      expect(decrypted).toBe(content)
    })

    it('should not re-encrypt already encrypted file', () => {
      const filePath = path.join(tmpDir, 'test.txt')
      fs.writeFileSync(filePath, 'content')

      encryptFile(filePath)
      const firstEncrypted = fs.readFileSync(filePath).toString()

      encryptFile(filePath) // Should be no-op
      const secondEncrypted = fs.readFileSync(filePath).toString()

      expect(firstEncrypted).toBe(secondEncrypted)
    })

    it('should skip non-existent files', () => {
      expect(() => encryptFile('/non/existent/file')).not.toThrow()
      expect(() => decryptFile('/non/existent/file')).not.toThrow()
    })
  })

  describe('encryptDirectory / decryptDirectory', () => {
    it('should encrypt and decrypt all files in directory', () => {
      // Create test files
      fs.writeFileSync(path.join(tmpDir, 'file1.txt'), 'content1')
      fs.writeFileSync(path.join(tmpDir, 'file2.txt'), 'content2')
      fs.mkdirSync(path.join(tmpDir, 'subdir'))
      fs.writeFileSync(path.join(tmpDir, 'subdir', 'file3.txt'), 'content3')

      const encrypted = encryptDirectory(tmpDir)
      expect(encrypted).toBe(3)

      // All files should start with ENC:
      expect(fs.readFileSync(path.join(tmpDir, 'file1.txt')).subarray(0, 4).toString()).toBe('ENC:')
      expect(fs.readFileSync(path.join(tmpDir, 'file2.txt')).subarray(0, 4).toString()).toBe('ENC:')
      expect(fs.readFileSync(path.join(tmpDir, 'subdir', 'file3.txt')).subarray(0, 4).toString()).toBe('ENC:')

      const decrypted = decryptDirectory(tmpDir)
      expect(decrypted).toBe(3)

      // All files should be back to original
      expect(fs.readFileSync(path.join(tmpDir, 'file1.txt')).toString()).toBe('content1')
      expect(fs.readFileSync(path.join(tmpDir, 'file2.txt')).toString()).toBe('content2')
      expect(fs.readFileSync(path.join(tmpDir, 'subdir', 'file3.txt')).toString()).toBe('content3')
    })

    it('should return 0 for empty directory', () => {
      const emptyDir = path.join(tmpDir, 'empty')
      fs.mkdirSync(emptyDir)
      expect(encryptDirectory(emptyDir)).toBe(0)
    })

    it('should return 0 for non-existent directory', () => {
      expect(encryptDirectory('/non/existent/dir')).toBe(0)
    })
  })
})
