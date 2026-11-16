import {
  sanitizeRoboticPhrases,
  type AIProviderName,
  type AIThinkingLevel,
  type AIUsageMetrics,
  type Message,
  type OwnerAlertPayload,
  type RetentionIntent,
  type StructuredRetentionOutput,
} from '../index.js';

export interface LLMCompletionParams {
  systemPrompt: string;
  history: Message[];
  userMessage: string;
  contactName: string;
  modelName?: string;
  thinkingLevel?: AIThinkingLevel;
}

export interface MultiProviderLLMOptions {
  provider?: AIProviderName;
  apiKey?: string;
  defaultModel?: string;
  thinkingLevel?: AIThinkingLevel;
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}

interface GeminiResponsePart {
  text?: string;
  thought?: boolean;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiResponsePart[];
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    thoughtsTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

/**
 * Extrae únicamente partes visibles para el usuario final, filtrando bloques internos `thought: true`
 * emitidos por modelos razonadores (Gemini 3.x / Gemini 4.x / Gemini 2.5 Thinking).
 */
export function extractVisibleGeminiText(
  data: GeminiGenerateContentResponse
): string {
  const parts = data.candidates?.[0]?.content?.parts || [];
  const visible = parts
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text!.trim())
    .filter(Boolean);
  return visible.join('\n').trim();
}

export function buildGeminiGenerationConfig(
  model: string,
  thinkingLevel: AIThinkingLevel,
  structuredJson: boolean
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    temperature: 0.5,
    maxOutputTokens: structuredJson ? 512 : 350,
  };

  const lowerModel = model.toLowerCase();
  if (lowerModel.includes('gemini-2.5')) {
    const budgetMap: Record<AIThinkingLevel, number> = {
      low: 512,
      medium: 1024,
      high: 2048,
      xhigh: 4096,
    };
    config.thinkingConfig = {
      thinkingBudget: budgetMap[thinkingLevel] ?? 2048,
      includeThoughts: false,
    };
  } else {
    // Gemini 3.x / 4.x utilizan thinkingLevel cualitativo
    const safeLevel =
      lowerModel.includes('3.8-flash') && thinkingLevel === 'xhigh'
        ? 'high'
        : thinkingLevel;
    config.thinkingConfig = {
      thinkingLevel: safeLevel,
      includeThoughts: false,
    };
  }

  if (structuredJson) {
    config.responseMimeType = 'application/json';
    config.responseSchema = {
      type: 'OBJECT',
      required: [
        'replyText',
        'intent',
        'confidence',
        'ownerSummaryTwoLines',
      ],
      properties: {
        replyText: {
          type: 'STRING',
          description:
            'Respuesta natural y humana en español rioplatense para el contacto de WhatsApp, sin jerga de IA ni avisos de transferencia.',
        },
        intent: {
          type: 'STRING',
          enum: ['CONTAIN', 'COMMERCIAL_HANDOFF', 'OPT_OUT', 'DEFER'],
        },
        confidence: {
          type: 'NUMBER',
        },
        ownerSummaryTwoLines: {
          type: 'STRING',
          description:
            'Resumen ejecutivo en exactamente 2 líneas para alertar al dueño del negocio.',
        },
      },
    };
  }

  return config;
}

/**
 * Adaptador polimórfico multi-proveedor (Gemini 3.8 High por defecto / OpenAI / Anthropic)
 * con salida estructurada JSON en un solo turno, filtro `thought`, backoff y telemetría FinOps.
 */
export class MultiProviderLLMAdapter {
  private readonly provider: AIProviderName;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly thinkingLevel: AIThinkingLevel;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MultiProviderLLMOptions = {}) {
    this.provider = options.provider ?? 'gemini';
    this.apiKey = options.apiKey ?? '';
    this.defaultModel = options.defaultModel ?? 'gemini-3.8-flash';
    this.thinkingLevel = options.thinkingLevel ?? 'high';
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async generateRetentionReply(params: LLMCompletionParams): Promise<string> {
    const decision = await this.generateStructuredRetentionDecision(params);
    return decision.replyText;
  }

  async summarizeConversationTwoLines(
    history: Message[],
    latestUserMessage: string,
    contactName: string
  ): Promise<string> {
    const cleanLatest = latestUserMessage.replace(/\s+/g, ' ').trim();
    const turnCount = history.length;

    if (!this.apiKey.trim()) {
      return [
        `Contacto ${contactName} (${turnCount} msjs en historial) requiere atención directa.`,
        `Último mensaje recibido: "${cleanLatest.slice(0, 140)}"`,
      ].join('\n');
    }

    try {
      const summaryPrompt =
        'Resume esta conversación de WhatsApp en exactamente 2 líneas breves y accionables para el dueño del negocio.';
      const res = await this.callTextCompletion({
        systemPrompt: summaryPrompt,
        history,
        userMessage: latestUserMessage,
        contactName,
      });
      const lines = res.text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 2);
      if (lines.length === 2) {
        return lines.join('\n');
      }
    } catch {
      // Fallback contextual
    }

    return [
      `Contacto ${contactName} (${turnCount} msjs en historial) requiere atención directa.`,
      `Último mensaje recibido: "${cleanLatest.slice(0, 140)}"`,
    ].join('\n');
  }

  /**
   * Ejecuta inferencia estructurada en 1 sola llamada (respuesta humana + intención + resumen de 2 líneas)
   * aprovechando Gemini 3.8 con thinkingLevel configurado.
   */
  async generateStructuredRetentionDecision(
    params: LLMCompletionParams
  ): Promise<StructuredRetentionOutput> {
    if (!this.apiKey.trim()) {
      return this.buildFallbackStructuredDecision(params);
    }

    const startedAt = Date.now();
    try {
      if (this.provider === 'gemini') {
        const result = await this.callGeminiStructured(params, startedAt);
        return {
          ...result,
          replyText: sanitizeRoboticPhrases(result.replyText),
        };
      }

      const textRes = await this.callTextCompletion(params);
      const fallback = this.buildFallbackStructuredDecision(params);
      return {
        ...fallback,
        replyText: sanitizeRoboticPhrases(textRes.text),
        usage: {
          provider: this.provider,
          model: params.modelName || this.defaultModel,
          promptTokens: textRes.promptTokens,
          thoughtTokens: 0,
          outputTokens: textRes.outputTokens,
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch {
      return this.buildFallbackStructuredDecision(params);
    }
  }

  private buildFallbackStructuredDecision(
    params: LLMCompletionParams
  ): StructuredRetentionOutput {
    const firstName =
      params.contactName.split(' ')[0]?.trim() || '¿cómo estás?';
    const lower = params.userMessage.toLowerCase();
    const isCommercial =
      /\b(precio|costo|presupuesto|reunion|reunión|comprar|contratar|llamar|llamame|asesor)\b/i.test(
        lower
      );
    const isOptOut =
      /\b(no me interesa|darme de baja|dame de baja|baja|sacame|borrame|desuscribir|no molestar|spam)\b/i.test(
        lower
      );

    const intent: RetentionIntent = isOptOut
      ? 'OPT_OUT'
      : isCommercial
      ? 'COMMERCIAL_HANDOFF'
      : 'CONTAIN';

    const replyText = isCommercial
      ? `¡Hola ${firstName}! Qué bueno leerte. Ya mismo reviso los detalles de lo que me consultás para pasarte la propuesta exacta por acá en unos minutos.`
      : `¡Hola ${firstName}! Gracias por escribirnos. Recibí tu mensaje, contame un poquito más de lo que estás buscando así te doy una respuesta bien puntual.`;

    const cleanMsg = params.userMessage.replace(/\s+/g, ' ').trim().slice(0, 140);
    return {
      replyText: sanitizeRoboticPhrases(replyText),
      intent,
      confidence: 0.7,
      ownerSummaryTwoLines: [
        `Contacto ${params.contactName} (${params.history.length} msjs) — Intención: ${intent}.`,
        `Último mensaje: "${cleanMsg || '[Adjunto]'}"`,
      ].join('\n'),
    };
  }

  private buildPromptContext(params: LLMCompletionParams): {
    fullSystemPrompt: string;
    userPrompt: string;
  } {
    const historyLines = params.history
      .slice(-10)
      .map(
        (m) =>
          `${m.direction === 'INBOUND' ? params.contactName : 'Nosotros'}: ${m.body}`
      )
      .join('\n');

    const antiRoboticGuard =
      'REGLA ESTRICTA: Responde como una persona real del equipo en WhatsApp. PROHIBIDO decir "Como modelo de lenguaje", "Soy una IA", "Soy un asistente virtual" o "Te transfiero con un asesor".';

    const fullSystemPrompt = `${params.systemPrompt}\n${antiRoboticGuard}`;
    const userPrompt = historyLines
      ? `Historial reciente:\n${historyLines}\n\nNuevo mensaje de ${params.contactName}: ${params.userMessage}`
      : `Nuevo mensaje de ${params.contactName}: ${params.userMessage}`;

    return { fullSystemPrompt, userPrompt };
  }

  private async fetchWithRetry(
    url: string,
    initFactory: (signal: AbortSignal) => RequestInit
  ): Promise<Response> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(url, initFactory(controller.signal));
        if ((res.status === 429 || res.status === 503) && attempt < this.maxRetries) {
          const backoffMs = 400 * 2 ** attempt;
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        return res;
      } catch (err) {
        lastErr = err;
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, 350 * 2 ** attempt));
        }
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('LLM request failed');
  }

  private async callGeminiStructured(
    params: LLMCompletionParams,
    startedAt: number
  ): Promise<StructuredRetentionOutput> {
    const model = params.modelName || this.defaultModel;
    const thinkingLevel = params.thinkingLevel || this.thinkingLevel;
    const { fullSystemPrompt, userPrompt } = this.buildPromptContext(params);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const res = await this.fetchWithRetry(endpoint, (signal) => ({
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: `${fullSystemPrompt}\nDevuelve estrictamente JSON con replyText, intent (CONTAIN | COMMERCIAL_HANDOFF | OPT_OUT | DEFER), confidence y ownerSummaryTwoLines (exactamente 2 líneas).`,
            },
          ],
        },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: buildGeminiGenerationConfig(
          model,
          thinkingLevel,
          true
        ),
      }),
    }));

    if (!res.ok) {
      throw new Error(`Gemini HTTP ${res.status}`);
    }

    const data = (await res.json()) as GeminiGenerateContentResponse;
    const rawVisible = extractVisibleGeminiText(data);
    if (!rawVisible) {
      return this.buildFallbackStructuredDecision(params);
    }

    const usage: AIUsageMetrics = {
      provider: 'gemini',
      model,
      promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
      thoughtTokens: data.usageMetadata?.thoughtsTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs: Date.now() - startedAt,
    };

    try {
      const cleanedJson = rawVisible
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      const parsed = JSON.parse(cleanedJson) as Partial<StructuredRetentionOutput>;
      if (parsed.replyText && parsed.intent) {
        return {
          replyText: sanitizeRoboticPhrases(parsed.replyText),
          intent: parsed.intent,
          confidence:
            typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
          ownerSummaryTwoLines:
            parsed.ownerSummaryTwoLines ||
            this.buildFallbackStructuredDecision(params).ownerSummaryTwoLines,
          usage,
        };
      }
    } catch {
      // Si el modelo respondió texto libre válido en lugar de JSON, lo aprovechamos de forma segura
    }

    const fallback = this.buildFallbackStructuredDecision(params);
    return {
      ...fallback,
      replyText: sanitizeRoboticPhrases(rawVisible),
      usage,
    };
  }

  private async callTextCompletion(params: LLMCompletionParams): Promise<{
    text: string;
    promptTokens: number;
    outputTokens: number;
  }> {
    const model = params.modelName || this.defaultModel;
    const thinkingLevel = params.thinkingLevel || this.thinkingLevel;
    const { fullSystemPrompt, userPrompt } = this.buildPromptContext(params);

    if (this.provider === 'gemini') {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
      const res = await this.fetchWithRetry(endpoint, (signal) => ({
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: fullSystemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: buildGeminiGenerationConfig(
            model,
            thinkingLevel,
            false
          ),
        }),
      }));
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const data = (await res.json()) as GeminiGenerateContentResponse;
      return {
        text: extractVisibleGeminiText(data),
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      };
    }

    if (this.provider === 'anthropic') {
      const res = await this.fetchWithRetry(
        'https://api.anthropic.com/v1/messages',
        (signal) => ({
          method: 'POST',
          signal,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 350,
            system: fullSystemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        })
      );
      if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
      const data = (await res.json()) as {
        content?: Array<{ text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      return {
        text: data.content?.[0]?.text || '',
        promptTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      };
    }

    const res = await this.fetchWithRetry(
      'https://api.openai.com/v1/chat/completions',
      (signal) => ({
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.6,
          max_tokens: 350,
          messages: [
            { role: 'system', content: fullSystemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      })
    );
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: data.choices?.[0]?.message?.content || '',
      promptTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
    };
  }
}

export class OwnerWebhookNotifier {
  public readonly dispatchedAlerts: OwnerAlertPayload[] = [];
  private readonly defaultWebhookUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    defaultWebhookUrl = '',
    fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis)
  ) {
    this.defaultWebhookUrl = defaultWebhookUrl;
    this.fetchImpl = fetchImpl;
  }

  async sendOwnerAlert(
    alert: OwnerAlertPayload,
    webhookUrlOverride?: string | null
  ): Promise<boolean> {
    this.dispatchedAlerts.push(alert);
    const targetUrl = (webhookUrlOverride || this.defaultWebhookUrl || '').trim();
    if (!targetUrl) {
      return true;
    }

    try {
      const res = await this.fetchImpl(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'ai.handoff.alert',
          ...alert,
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
