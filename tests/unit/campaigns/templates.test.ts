// tests/unit/campaigns/templates.test.ts
import { describe, it, expect } from 'vitest'
import {
  applySynonymVariation,
  applyFormatVariation,
  fillTemplate,
  generateVariation,
  selectVariation,
} from '../../../src/campaigns/templates'

describe('campaigns/templates', () => {
  describe('fillTemplate()', () => {
    it('replaces variables', () => {
      const result = fillTemplate('Hola {{nombre}}, bienvenido a {{empresa}}!', {
        nombre: 'Pedro',
        empresa: 'MiEmpresa',
      })
      expect(result).toBe('Hola Pedro, bienvenido a MiEmpresa!')
    })

    it('leaves unmatched variables as-is', () => {
      const result = fillTemplate('Hola {{nombre}}!', {})
      expect(result).toBe('Hola {{nombre}}!')
    })

    it('replaces multiple occurrences', () => {
      const result = fillTemplate('{{nombre}} y {{nombre}}', { nombre: 'Ana' })
      expect(result).toBe('Ana y Ana')
    })
  })

  describe('applySynonymVariation()', () => {
    it('replaces known synonyms', () => {
      const results = new Set<string>()
      for (let i = 0; i < 20; i++) {
        results.add(applySynonymVariation('Hola, gracias por tu consulta'))
      }
      // Should produce at least 2 different variations
      expect(results.size).toBeGreaterThan(1)
    })

    it('preserves text without synonyms', () => {
      const text = 'El producto cuesta $1000'
      expect(applySynonymVariation(text)).toBe(text)
    })
  })

  describe('applyFormatVariation()', () => {
    it('produces variations', () => {
      const text = 'Hola, cómo estás'
      const results = new Set<string>()
      for (let i = 0; i < 20; i++) {
        results.add(applyFormatVariation(text))
      }
      // Should produce at least 2 different variations
      expect(results.size).toBeGreaterThan(1)
    })
  })

  describe('generateVariation()', () => {
    it('combines all variation techniques', () => {
      const text = 'Hola {{nombre}}, gracias por consultar sobre nuestros servicios'
      const result = generateVariation(text, { nombre: 'Pedro' })
      expect(result).toContain('Pedro')
      expect(result.length).toBeGreaterThan(10)
    })
  })

  describe('selectVariation()', () => {
    it('returns empty for empty array', () => {
      expect(selectVariation([])).toBe('')
    })

    it('returns the only item for single-element array', () => {
      expect(selectVariation(['hello'])).toBe('hello')
    })

    it('selects from multiple templates', () => {
      const templates = ['a', 'b', 'c']
      const selected = selectVariation(templates)
      expect(templates).toContain(selected)
    })
  })
})
