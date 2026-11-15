import {
  sanitizeRoboticPhrases,
  type AIProviderName,
  type Message,
  type OwnerAlertPayload,
} from '@mejoraws/shared';
import type {
  ILLMProvider,
  IOwnerAlertNotifier,
  LLMCompletionParams,
} from '../../domain/ports.js';
import { env } from '../../config/env.js';

export interface MultiProviderLLMOptions {
  provider?: AIProviderName;
  apiKey?: string;
  defaultModel?: string;
  timeoutMs?: number;
}

export class MultiProviderLLMAdapter implements ILLMProvider {
  private readonly provider: AIProviderName;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(options: MultiProviderLLMOptions = {}) {
    this.provider = options.provider ?? env.AI_PROVIDER;
    this.apiKey = options.apiKey ?? env.AI_API_KEY;
    this.defaultModel = options.defaultModel ?? env.AI_MODEL;
    this.timeoutMs = options.timeoutMs ?? 12000;
  }

  async generateRetentionReply(params: LLMCompletionParams): Promise<string> {
    if (!this.apiKey.trim()) {
      return sanitizeRoboticPhrases(this.buildContextualFallbackReply(params));
    }

    try {
      const raw = await this.callProviderAPI(params);
      return sanitizeRoboticPhrases(raw);
    } catch {
      return sanitizeRoboticPhrases(this.buildContextualFallbackReply(params));
    }
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
      const raw = await this.callProviderAPI({
        systemPrompt: summaryPrompt,
        history,
        userMessage: latestUserMessage,
        contactName,
      });
      const lines = raw
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 2);
      if (lines.length === 2) {
        return lines.join('\n');
      }
    } catch {
      // Fallback en caso de error de red del proveedor
    }

    return [
      `Contacto ${contactName} (${turnCount} msjs en historial) requiere atención directa.`,
      `Último mensaje recibido: "${cleanLatest.slice(0, 140)}"`,
    ].join('\n');
  }

  private buildContextualFallbackReply(params: LLMCompletionParams): string {
    const firstName =
      params.contactName.split(' ')[0]?.trim() || '¿cómo estás?';
    const lower = params.userMessage.toLowerCase();

    if (
      lower.includes('precio') ||
      lower.includes('costo') ||
      lower.includes('presupuesto') ||
      lower.includes('reunion') ||
      lower.includes('reunión') ||
      lower.includes('comprar')
    ) {
      return `¡Hola ${firstName}! Qué bueno leerte. Ya mismo reviso los detalles de lo que me comentás para pasarte la propuesta exacta por acá en unos minutos.`;
    }

    return `¡Hola ${firstName}! Gracias por escribirnos. Recibí tu mensaje, contame un poquito más de lo que estás buscando así te doy una respuesta bien puntual.`;
  }

  private async callProviderAPI(params: LLMCompletionParams): Promise<string> {
    const model = params.modelName || this.defaultModel;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const historyLines = params.history
      .slice(-10)
      .map(
        (m) =>
          `${m.direction === 'INBOUND' ? params.contactName : 'Nosotros'}: ${
            m.body
          }`
      )
      .join('\n');

    const AntiRoboticGuard =
      'REGLA ESTRICTA: Responde como una persona real del equipo en WhatsApp. PROHIBIDO decir "Como modelo de lenguaje", "Soy una IA", "Soy un asistente virtual" o "Te transfiero con un asesor".';

    const fullSystemPrompt = `${params.systemPrompt}\n${AntiRoboticGuard}`;
    const userPrompt = historyLines
      ? `Historial reciente:\n${historyLines}\n\nNuevo mensaje de ${params.contactName}: ${params.userMessage}`
      : params.userMessage;

    try {
      if (this.provider === 'gemini') {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model
        )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: fullSystemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          }),
        });
        if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
        const data = (await res.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        return (
          data.candidates?.[0]?.content?.parts?.[0]?.text ||
          this.buildContextualFallbackReply(params)
        );
      }

      if (this.provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 300,
            system: fullSystemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
        const data = (await res.json()) as {
          content?: Array<{ text?: string }>;
        };
        return (
          data.content?.[0]?.text || this.buildContextualFallbackReply(params)
        );
      }

      // Default: OpenAI
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.6,
          max_tokens: 300,
          messages: [
            { role: 'system', content: fullSystemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return (
        data.choices?.[0]?.message?.content ||
        this.buildContextualFallbackReply(params)
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

export class OwnerWebhookNotifier implements IOwnerAlertNotifier {
  public readonly dispatchedAlerts: OwnerAlertPayload[] = [];
  private readonly defaultWebhookUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    defaultWebhookUrl = env.OWNER_ALERT_WEBHOOK_URL,
    fetchImpl: typeof fetch = globalThis.fetch
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
