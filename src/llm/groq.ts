// src/llm/groq.ts
// Groq API — LLM primario (gratis)

import Groq from 'groq-sdk'

export interface LLMResponse {
  content: string
  model: string
  tokensUsed: number
}

export class GroqClient {
  private groq: Groq
  private model: string

  constructor(apiKey?: string) {
    this.groq = new Groq({
      apiKey: apiKey || process.env.GROQ_API_KEY || '',
    })
    this.model = 'qwen-2.5-32b'
  }

  /**
   * Genera una respuesta de chat
   */
  async chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
      temperature?: number
      maxTokens?: number
    }
  ): Promise<LLMResponse> {
    try {
      const completion = await this.groq.chat.completions.create({
        messages,
        model: this.model,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 500,
      })

      const choice = completion.choices[0]
      return {
        content: choice.message?.content || '',
        model: this.model,
        tokensUsed: completion.usage?.total_tokens || 0,
      }
    } catch (error: any) {
      // Si Groq falla, lanzar error para que Ollama tome el relevo
      throw new Error(`Groq API error: ${error.message}`)
    }
  }

  /**
   * Genera una respuesta simple (shorthand)
   */
  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    const response = await this.chat(messages)
    return response.content
  }

  /**
   * Verifica si el cliente está configurado
   */
  isConfigured(): boolean {
    return !!process.env.GROQ_API_KEY
  }

  /**
   * Cambia el modelo
   */
  setModel(model: string): void {
    this.model = model
  }
}
