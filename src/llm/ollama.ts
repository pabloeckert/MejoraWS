// src/llm/ollama.ts
// Ollama — LLM backup local (gratis, sin internet)

export class OllamaClient {
  private baseUrl: string
  private model: string

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'llama3.1:8b') {
    this.baseUrl = baseUrl
    this.model = model
  }

  /**
   * Genera una respuesta
   */
  async chat(
    messages: Array<{ role: string; content: string }>,
    options?: {
      temperature?: number
      maxTokens?: number
    }
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens ?? 500,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`)
      }

      const data: any = await response.json()
      return data.message?.content || ''
    } catch (error: any) {
      throw new Error(`Ollama error: ${error.message}`)
    }
  }

  /**
   * Genera una respuesta simple (shorthand)
   */
  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: Array<{ role: string; content: string }> = []
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    return this.chat(messages)
  }

  /**
   * Verifica si Ollama está disponible
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Lista modelos disponibles
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      const data: any = await response.json()
      return data.models?.map((m: any) => m.name) || []
    } catch {
      return []
    }
  }

  /**
   * Cambia el modelo
   */
  setModel(model: string): void {
    this.model = model
  }
}
