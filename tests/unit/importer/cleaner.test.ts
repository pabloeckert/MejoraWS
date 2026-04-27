// tests/unit/importer/cleaner.test.ts
import { describe, it, expect } from 'vitest'
import { autoMapColumns, cleanPhone, cleanContact, cleanContacts } from '../../../src/importer/cleaner'

describe('cleaner', () => {
  describe('cleanPhone()', () => {
    it('normalizes Argentine phone numbers', () => {
      expect(cleanPhone('011-1234-5678')).toBe('5491112345678')
      expect(cleanPhone('+54 9 11 1234-5678')).toBe('+5491112345678')
      expect(cleanPhone('11 1234 5678')).toBe('5491112345678')
    })

    it('preserves + prefix for international numbers', () => {
      // Note: cleanPhone normalizes to Argentine format by default
      // 10-digit numbers get prefixed with 549
      expect(cleanPhone('+5491112345678')).toBe('+5491112345678')
    })

    it('removes non-digit characters except +', () => {
      expect(cleanPhone('(011) 1234-5678')).toBe('5491112345678')
    })

    it('handles already normalized numbers', () => {
      expect(cleanPhone('5491112345678')).toBe('5491112345678')
    })
  })

  describe('autoMapColumns()', () => {
    it('maps Spanish column names', () => {
      const raw = [
        { 'nombre': 'Pedro', 'teléfono': '011-1234-5678', 'correo': 'pedro@test.com' },
      ]
      const result = autoMapColumns(raw)
      expect(result[0].name).toBe('Pedro')
      expect(result[0].phone).toBe('011-1234-5678')
      expect(result[0].email).toBe('pedro@test.com')
    })

    it('maps English column names', () => {
      const raw = [
        { 'name': 'Ana', 'phone': '+5491198765432', 'email': 'ana@test.com' },
      ]
      const result = autoMapColumns(raw)
      expect(result[0].name).toBe('Ana')
      expect(result[0].phone).toBe('+5491198765432')
      expect(result[0].email).toBe('ana@test.com')
    })

    it('auto-maps by content when headers unknown', () => {
      const raw = [
        { 'col1': 'Pedro', 'col2': '011-1234-5678', 'col3': 'pedro@test.com' },
      ]
      const result = autoMapColumns(raw)
      expect(result[0].email).toBe('pedro@test.com')
      expect(result[0].phone).toBe('011-1234-5678')
    })

    it('returns empty array for empty input', () => {
      expect(autoMapColumns([])).toEqual([])
    })
  })

  describe('cleanContact()', () => {
    it('cleans name whitespace', () => {
      const contact = { name: '  Pedro   García  ', phone: null, email: null, company: null, tags: [], source: 'test', score: 0 }
      const cleaned = cleanContact(contact)
      expect(cleaned.name).toBe('Pedro García')
    })

    it('removes short names', () => {
      const contact = { name: 'A', phone: null, email: null, company: null, tags: [], source: 'test', score: 0 }
      const cleaned = cleanContact(contact)
      expect(cleaned.name).toBeNull()
    })

    it('lowercases email', () => {
      const contact = { name: null, phone: null, email: ' Pedro@TEST.com ', company: null, tags: [], source: 'test', score: 0 }
      const cleaned = cleanContact(contact)
      expect(cleaned.email).toBe('pedro@test.com')
    })

    it('removes invalid emails', () => {
      const contact = { name: null, phone: null, email: 'notanemail', company: null, tags: [], source: 'test', score: 0 }
      const cleaned = cleanContact(contact)
      expect(cleaned.email).toBeNull()
    })
  })

  describe('cleanContacts()', () => {
    it('filters out contacts with no phone and no email', () => {
      const contacts = [
        { name: 'Pedro', phone: '011-1234-5678', email: null, company: null, tags: [], source: 'test', score: 0 },
        { name: 'Ghost', phone: null, email: null, company: null, tags: [], source: 'test', score: 0 },
        { name: 'Ana', phone: null, email: 'ana@test.com', company: null, tags: [], source: 'test', score: 0 },
      ]
      const cleaned = cleanContacts(contacts)
      expect(cleaned.length).toBe(2)
    })
  })
})
