// tests/unit/brain/prompt-templates.test.ts
// Tests for industry-specific prompt templates

import { describe, it, expect } from 'vitest'
import {
  getTemplateByIndustry,
  getAvailableTemplates,
  buildPromptFromTemplate,
  PROMPT_TEMPLATES,
} from '../../../src/brain/prompt-templates'

describe('Prompt Templates', () => {
  it('returns all available templates', () => {
    const templates = getAvailableTemplates()
    expect(templates.length).toBeGreaterThanOrEqual(6)
    expect(templates.map(t => t.id)).toContain('real-estate')
    expect(templates.map(t => t.id)).toContain('ecommerce')
    expect(templates.map(t => t.id)).toContain('services')
    expect(templates.map(t => t.id)).toContain('health-wellness')
    expect(templates.map(t => t.id)).toContain('education')
    expect(templates.map(t => t.id)).toContain('general')
  })

  it('getTemplateByIndustry returns correct template', () => {
    const t = getTemplateByIndustry('ecommerce')
    expect(t.id).toBe('ecommerce')
    expect(t.name).toBe('E-commerce / Tienda')
    expect(t.objectionHandlers).toBeDefined()
  })

  it('getTemplateByIndustry falls back to general for unknown', () => {
    const t = getTemplateByIndustry('nonexistent')
    expect(t.id).toBe('general')
  })

  it('buildPromptFromTemplate includes personality', () => {
    const template = getTemplateByIndustry('ecommerce')
    const prompt = buildPromptFromTemplate(template, { name: 'María', company: 'Mi Tienda' })
    expect(prompt).toContain('María')
    expect(prompt).toContain('Mi Tienda')
  })

  it('buildPromptFromTemplate includes knowledge base', () => {
    const template = getTemplateByIndustry('services')
    const prompt = buildPromptFromTemplate(template, {
      name: 'Ana',
      knowledge: 'Ofrecemos consultoría fiscal y contable.',
    })
    expect(prompt).toContain('consultoría fiscal y contable')
  })

  it('buildPromptFromTemplate includes intent and deal stage', () => {
    const template = getTemplateByIndustry('real-estate')
    const prompt = buildPromptFromTemplate(template, {
      name: 'Carlos',
      intent: 'COMPRA',
      dealStage: 'propuesta',
    })
    expect(prompt).toContain('COMPRA')
    expect(prompt).toContain('propuesta')
  })

  it('buildPromptFromTemplate includes objection handlers', () => {
    const template = getTemplateByIndustry('ecommerce')
    const prompt = buildPromptFromTemplate(template, { name: 'Bot' })
    expect(prompt).toContain('objeciones')
    expect(prompt).toContain('caro')
  })

  it('all templates have required fields', () => {
    for (const template of PROMPT_TEMPLATES) {
      expect(template.id).toBeTruthy()
      expect(template.name).toBeTruthy()
      expect(template.industry).toBeTruthy()
      expect(template.personality).toContain('{name}')
      expect(template.rules.length).toBeGreaterThan(0)
      expect(template.greetings.length).toBeGreaterThan(0)
      expect(template.closings.length).toBeGreaterThan(0)
    }
  })
})
