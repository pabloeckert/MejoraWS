// tests/unit/importer/deduplicator.test.ts
import { describe, it, expect } from 'vitest'
import { deduplicate, deduplicateByPhone, deduplicateByEmail } from '../../../src/importer/deduplicator'
import { CleanContact } from '../../../src/importer/cleaner'

function makeContact(overrides: Partial<CleanContact> = {}): CleanContact {
  return {
    name: null,
    phone: null,
    email: null,
    company: null,
    tags: [],
    source: 'test',
    score: 0,
    ...overrides,
  }
}

describe('deduplicator', () => {
  describe('deduplicateByPhone()', () => {
    it('removes duplicates by phone', () => {
      const contacts = [
        makeContact({ phone: '5491112345678', name: 'Pedro' }),
        makeContact({ phone: '5491112345678', name: 'Pedro G' }),
      ]
      const result = deduplicateByPhone(contacts)
      expect(result.length).toBe(1)
    })

    it('merges data from duplicates', () => {
      const contacts = [
        makeContact({ phone: '5491112345678', name: 'Pedro' }),
        makeContact({ phone: '5491112345678', email: 'pedro@test.com' }),
      ]
      const result = deduplicateByPhone(contacts)
      expect(result.length).toBe(1)
      expect(result[0].name).toBe('Pedro')
      expect(result[0].email).toBe('pedro@test.com')
    })

    it('keeps unique phones', () => {
      const contacts = [
        makeContact({ phone: '5491111111111' }),
        makeContact({ phone: '5491122222222' }),
      ]
      const result = deduplicateByPhone(contacts)
      expect(result.length).toBe(2)
    })
  })

  describe('deduplicateByEmail()', () => {
    it('removes duplicates by email', () => {
      const contacts = [
        makeContact({ email: 'pedro@test.com', name: 'Pedro' }),
        makeContact({ email: 'pedro@test.com', name: 'Pedro G' }),
      ]
      const result = deduplicateByEmail(contacts)
      expect(result.length).toBe(1)
    })

    it('keeps contacts without email', () => {
      const contacts = [
        makeContact({ email: 'pedro@test.com' }),
        makeContact({ phone: '5491111111111' }),
      ]
      const result = deduplicateByEmail(contacts)
      expect(result.length).toBe(2)
    })
  })

  describe('deduplicate() (full pipeline)', () => {
    it('deduplicates by phone, then email, then name', () => {
      const contacts = [
        makeContact({ phone: '5491112345678', name: 'Pedro' }),
        makeContact({ phone: '5491112345678', email: 'pedro@test.com' }),
        makeContact({ email: 'ana@test.com', name: 'Ana' }),
        makeContact({ email: 'ana@test.com', name: 'Ana López' }),
      ]
      const result = deduplicate(contacts)
      expect(result.length).toBe(2)
    })

    it('handles empty array', () => {
      expect(deduplicate([])).toEqual([])
    })

    it('handles single contact', () => {
      const contacts = [makeContact({ phone: '5491111111111' })]
      expect(deduplicate(contacts).length).toBe(1)
    })
  })
})
