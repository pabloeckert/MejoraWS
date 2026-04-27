// src/brain/auto-reply.ts
// Motor de auto-respuesta IA

import { LLMManager } from '../llm'
import { c, status } from '../cli/theme'
import Database, { Database as DatabaseType } from 'better-sqlite3'
import { generateId } from '../db/database'

export interface BotConfig {
  name: string
  personality: string
  tone: string
  language: string
  schedule: { start: number; end: number }
  escalation: {
    keywords: string[]
    maxExchanges: number
    negativeSentiment: boolean
  }
}

export interface ConversationContext {
  contactPhone: string
  contactName?: string
  history: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>
  dealStage?: string
  lastInteraction?: string
}

const DEFAULT_CONFIG: BotConfig = {
  name: 'María',
  personality: 'Soy María, asesora de ventas. Respondo de forma clara, amable y profesional. Nunca sueno a robot. Si no sé algo, lo digo honestamente.',
  tone: 'profesional-cercano',
  language: 'español',
  schedule: { start: 8, end: 20 },
  escalation: {
    keywords: ['hablar con alguien', 'agente', 'urgente', 'supervisor', 'jefe'],
    maxExchanges: 3,
    negativeSentiment: true,
  },
}

export class AutoReplyEngine {
  private llm: LLMManager
  private db: DatabaseType
  private config: BotConfig
  private knowledgeBase: string = ''
  private exchangeCounts: Map<string, number> = new Map()

  constructor(llm: LLMManager, db: DatabaseType, config?: Partial<BotConfig>) {
    this.llm = llm
    this.db = db
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Procesa un mensaje entrante y genera una respuesta
   */
  async handleMessage(
    from: string,
    text: string,
    contactName?: string
  ): Promise<{ response: string; escalated: boolean; intent: string }> {
    // 1. Verificar horario
    const hour = new Date().getHours()
    if (hour < this.config.schedule.start || hour >= this.config.schedule.end) {
      return {
        response: `Hola${contactName ? ` ${contactName}` : ''}! Gracias por tu mensaje. Nuestro horario de atención es de ${this.config.schedule.start}:00 a ${this.config.schedule.end}:00. Te responderemos pronto.`,
        escalated: false,
        intent: 'FUERA_HORARIO',
      }
    }

    // 2. Detectar intención
    const intent = await this.llm.detectIntent(text)

    // 3. Verificar escalamiento
    const needsEscalation = this.checkEscalation(from, text, intent)
    if (needsEscalation) {
      return {
        response: `Gracias por tu mensaje, ${contactName || 'estamos'} conectándote con un asesor humano que te ayudará mejor. Un momento por favor.`,
        escalated: true,
        intent,
      }
    }

    // 4. Obtener contexto de conversación
    const context = this.getConversationContext(from, contactName)

    // 5. Generar respuesta
    const response = await this.generateResponse(text, context, intent)

    // 6. Registrar interacción
    this.saveInteraction(from, text, response, intent)

    // 7. Incrementar contador de intercambios
    const count = (this.exchangeCounts.get(from) || 0) + 1
    this.exchangeCounts.set(from, count)

    return { response, escalated: false, intent }
  }

  /**
   * Verifica si se necesita escalamiento a humano
   */
  private checkEscalation(from: string, text: string, intent: string): boolean {
    const lowerText = text.toLowerCase()

    // Keywords de escalamiento
    if (this.config.escalation.keywords.some(kw => lowerText.includes(kw))) {
      return true
    }

    // Intención de queja
    if (intent === 'QUEJA' && this.config.escalation.negativeSentiment) {
      return true
    }

    // Muchos intercambios sin resolver
    const count = this.exchangeCounts.get(from) || 0
    if (count >= this.config.escalation.maxExchanges && intent === 'CONSULTA') {
      return true
    }

    return false
  }

  /**
   * Obtiene contexto de conversación reciente
   */
  private getConversationContext(phone: string, contactName?: string): ConversationContext {
    // Obtener historial reciente
    const history = this.db.prepare(`
      SELECT direction, content, created_at
      FROM messages
      WHERE contact_phone = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(phone) as any[]

    // Obtener deal activo
    const deal = this.db.prepare(`
      SELECT stage FROM deals
      WHERE contact_phone = ? AND stage NOT IN ('cerrado-ganado', 'cerrado-perdido')
      ORDER BY updated_at DESC LIMIT 1
    `).get(phone) as any

    return {
      contactPhone: phone,
      contactName,
      history: history.reverse().map(h => ({
        role: h.direction === 'inbound' ? 'user' as const : 'assistant' as const,
        content: h.content,
        timestamp: h.created_at,
      })),
      dealStage: deal?.stage,
    }
  }

  /**
   * Genera una respuesta usando el LLM
   */
  private async generateResponse(
    text: string,
    context: ConversationContext,
    intent: string
  ): Promise<string> {
    // Construir system prompt
    const systemPrompt = `${this.config.personality}

Tu nombre es ${this.config.name}.
Tono: ${this.config.tone}
Idioma: ${this.config.language}

${this.knowledgeBase ? `Información del negocio:\n${this.knowledgeBase}` : ''}

Reglas:
- Respondé de forma natural y humana, como una persona real
- Sé concisa (máximo 2-3 oraciones)
- No uses emojis excesivos (1-2 máximo)
- Si no sabés algo, decilo honestamente
- Si el contacto parece interesado en comprar, ofrecé más detalles
- Usá el nombre del contacto si lo conocés

Intención detectada: ${intent}
${context.dealStage ? `Estado del deal: ${context.dealStage}` : ''}`

    // Construir historial para el LLM
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...context.history.slice(-6).map(h => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: text },
    ]

    const response = await this.llm.chat(messages, {
      temperature: 0.7,
      maxTokens: 200,
    })

    return response.content
  }

  /**
   * Guarda la interacción en la DB
   */
  private saveInteraction(from: string, inbound: string, outbound: string, intent: string): void {
    // Registrar actividad
    this.db.prepare(`
      INSERT INTO activities (id, contact_phone, type, description, metadata)
      VALUES (?, ?, 'bot_reply', ?, ?)
    `).run(
      generateId(),
      from,
      `Bot respondió a: "${inbound.substring(0, 50)}..."`,
      JSON.stringify({ intent, responseLength: outbound.length })
    )
  }

  /**
   * Actualiza la knowledge base
   */
  setKnowledgeBase(kb: string): void {
    this.knowledgeBase = kb
  }

  /**
   * Actualiza la configuración del bot
   */
  updateConfig(config: Partial<BotConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Resetea el contador de intercambios de un contacto
   */
  resetExchangeCount(phone: string): void {
    this.exchangeCounts.delete(phone)
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig(): BotConfig {
    return { ...this.config }
  }
}
