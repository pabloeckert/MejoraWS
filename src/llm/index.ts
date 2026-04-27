// src/llm/index.ts
// LLM Manager — Groq (primario) + Ollama (backup local)

import { GroqClient } from './groq'
import { OllamaClient } from './ollama'
import { c, status } from '../cli/theme'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class LLMManager {
  private groq: GroqClient
  private ollama: OllamaClient
  private preferLocal: boolean = false

  constructor() {
    this.groq = new GroqClient()
    this.ollama = new OllamaClient()
  }

  /**
   * Genera una respuesta usando el mejor LLM disponible
   * Prioridad: Groq → Ollama
   */
  async chat(
    messages: ChatMessage[],
    options?: {
      temperature?: number
      maxTokens?: number
    }
  ): Promise<{ content: string; model: string }> {
    // Si se prefiere local, intentar Ollama primero
    if (this.preferLocal) {
      try {
        const content = await this.ollama.chat(messages, options)
        return { content, model: 'ollama/llama3.1:8b' }
      } catch {
        // Fallback a Groq
      }
    }

    // Intentar Groq primero (más rápido)
    if (this.groq.isConfigured()) {
      try {
        const response = await this.groq.chat(messages, options)
        return { content: response.content, model: response.model }
      } catch (error) {
        console.log(status.warn('Groq falló, intentando Ollama...'))
      }
    }

    // Fallback a Ollama
    try {
      const content = await this.ollama.chat(messages, options)
      return { content, model: 'ollama/llama3.1:8b' }
    } catch (error) {
      throw new Error('No hay LLM disponible. Configurá GROQ_API_KEY o iniciá Ollama.')
    }
  }

  /**
   * Genera una respuesta simple (shorthand)
   */
  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: ChatMessage[] = []
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    const response = await this.chat(messages)
    return response.content
  }

  /**
   * Detecta la intención de un mensaje
   */
  async detectIntent(text: string): Promise<string> {
    const response = await this.generate(
      `Clasifica la intención de este mensaje en UNA sola palabra (CONSULTA, COMPRA, QUEJA, SALUDO, SOPORTE, PRECIO, OTRO):\n\n"${text}"`,
      'Sos un clasificador de intenciones. Respondé SOLO con la categoría, nada más.'
    )
    return response.trim().toUpperCase().replace(/[^A-Z]/g, '') || 'OTRO'
  }

  /**
   * Analiza el sentimiento de un mensaje
   */
  async analyzeSentiment(text: string): Promise<'positivo' | 'neutro' | 'negativo'> {
    const response = await this.generate(
      `Clasifica el sentimiento de este mensaje (positivo, neutro, negativo):\n\n"${text}"`,
      'Respondé SOLO con: positivo, neutro o negativo'
    )
    const sentiment = response.trim().toLowerCase()
    if (sentiment.includes('positivo')) return 'positivo'
    if (sentiment.includes('negativo')) return 'negativo'
    return 'neutro'
  }

  /**
   * Verifica qué LLM está disponible
   */
  async getStatus(): Promise<{ groq: boolean; ollama: boolean; active: string }> {
    const groqOk = this.groq.isConfigured()
    const ollamaOk = await this.ollama.isAvailable()

    let active = 'ninguno'
    if (groqOk && !this.preferLocal) active = 'groq'
    else if (ollamaOk) active = 'ollama'
    else if (groqOk) active = 'groq'

    return { groq: groqOk, ollama: ollamaOk, active }
  }

  /**
   * Cambia preferencia de LLM
   */
  setPreferLocal(prefer: boolean): void {
    this.preferLocal = prefer
  }
}
