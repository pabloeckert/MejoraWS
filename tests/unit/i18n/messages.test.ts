// tests/unit/i18n/messages.test.ts
import { describe, it, expect } from 'vitest'
import { getMessages, t, detectLocale } from '../../../src/i18n/messages'

describe('i18n Messages', () => {
  describe('getMessages', () => {
    it('should return Spanish messages by default', () => {
      const msgs = getMessages()
      expect(msgs.auth.noToken).toBe('Token no proporcionado')
      expect(msgs.system.internalError).toBe('Error interno del servidor')
    })

    it('should return English messages', () => {
      const msgs = getMessages('en')
      expect(msgs.auth.noToken).toBe('No token provided')
      expect(msgs.system.internalError).toBe('Internal server error')
    })

    it('should fallback to Spanish for unknown locale', () => {
      const msgs = getMessages('fr' as any)
      expect(msgs.auth.noToken).toBe('Token no proporcionado')
    })
  })

  describe('t', () => {
    it('should get message by dot path', () => {
      expect(t('es', 'auth.invalidToken')).toBe('Token inválido')
      expect(t('en', 'auth.invalidToken')).toBe('Invalid token')
    })

    it('should return path if message not found', () => {
      expect(t('es', 'nonexistent.path')).toBe('nonexistent.path')
    })

    it('should replace variables', () => {
      const msg = t('es', 'rateLimit.retryAfter', { seconds: 30 })
      expect(msg).toBe('Intentá nuevamente en 30 segundos')
    })

    it('should handle nested paths', () => {
      expect(t('es', 'resource.notFound')).toBe('Recurso no encontrado')
      expect(t('en', 'campaigns.limitReached')).toBe('Daily message limit reached')
    })
  })

  describe('detectLocale', () => {
    it('should detect English', () => {
      expect(detectLocale('en-US,en;q=0.9')).toBe('en')
      expect(detectLocale('en-GB')).toBe('en')
    })

    it('should default to Spanish', () => {
      expect(detectLocale('es-AR,es;q=0.9')).toBe('es')
      expect(detectLocale('fr-FR')).toBe('es')
      expect(detectLocale(undefined)).toBe('es')
      expect(detectLocale('')).toBe('es')
    })
  })
})
