// src/api/schemas/index.ts
// Zod schemas para validación de inputs

import { z } from 'zod'

// === CONTACTS ===
export const createContactSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().min(7).max(20),
  email: z.string().email().optional(),
  company: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  score: z.number().int().min(0).max(100).optional(),
  whatsapp: z.boolean().optional(),
  consent: z.boolean().optional(),
})

export const updateContactSchema = createContactSchema.partial()

export const listContactsSchema = z.object({
  search: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  minScore: z.coerce.number().int().min(0).optional(),
  whatsapp: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// === DEALS ===
export const createDealSchema = z.object({
  contact_phone: z.string().min(7).max(20),
  value: z.number().min(0).optional(),
  notes: z.string().max(1000).optional(),
})

export const moveDealSchema = z.object({
  stage: z.enum([
    'nuevo', 'contactado', 'interesado', 'propuesta',
    'negociacion', 'cerrado-ganado', 'cerrado-perdido',
  ]),
})

export const updateDealSchema = z.object({
  value: z.number().min(0).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(1000).optional(),
  next_follow_up: z.string().datetime().optional(),
})

// === MESSAGES ===
export const sendMessageSchema = z.object({
  to: z.string().min(7).max(20),
  text: z.string().min(1).max(4096),
})

// === CAMPAIGNS ===
export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  objective: z.string().max(500).optional(),
  audience: z.string().max(500).optional(),
  template: z.string().min(1).max(4096),
  variations: z.array(z.string().max(4096)).optional(),
  scheduled_at: z.string().datetime().optional(),
})

// === BOT CONFIG ===
export const updateBotConfigSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  personality: z.string().max(1000).optional(),
  tone: z.string().max(50).optional(),
  language: z.string().max(20).optional(),
  schedule: z.object({
    start: z.number().int().min(0).max(23),
    end: z.number().int().min(0).max(23),
  }).optional(),
})

// === IMPORT ===
export const importSchema = z.object({
  source: z.string().max(50).optional(),
})
