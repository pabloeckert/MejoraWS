import {
  sanitizeRoboticPhrases,
  type AIRetentionDecision,
  type AIThinkingLevel,
  type Contact,
  type EscalationReason,
  type Message,
  type OwnerAlertPayload,
  type RealtimeEvent,
  type StructuredRetentionOutput,
} from '@mejoraws/shared';
import type {
  ILLMProvider,
  IOwnerAlertNotifier,
  IWorkerDataStore,
} from '../domain/ports.js';
import { env } from '../config/env.js';

export interface AIRetentionEngineDeps {
  dataStore: IWorkerDataStore;
  llmProvider: ILLMProvider;
  alertNotifier: IOwnerAlertNotifier;
  dashboardBaseUrl?: string;
  defaultThinkingLevel?: AIThinkingLevel;
  enqueueOutboundJob?: (
    job: NonNullable<AIRetentionDecision['scheduledJob']>,
    delayMs: number
  ) => Promise<void>;
  onRealtimeEvent?: (event: RealtimeEvent) => Promise<void>;
}

function normalizeText(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsWholePhrase(normalizedHaystack: string, phrase: string): boolean {
  const normPhrase = normalizeText(phrase).trim();
  if (!normPhrase) return false;
  const pattern = new RegExp(`(?:^|\\b|\\s)${escapeRegex(normPhrase)}(?:$|\\b|\\s)`, 'i');
  return pattern.test(normalizedHaystack);
}

const OPT_OUT_PHRASES = [
  'no me interesa',
  'darme de baja',
  'dame de baja',
  'baja',
  'sacame',
  'borrame',
  'no quiero recibir',
  'desuscribir',
  'no molestar',
  'numero equivocado',
  'denunciar',
  'spam',
  'eliminar mi numero',
];

const COMMERCIAL_INTENT_PHRASES = [
  'precio',
  'costo',
  'cuanto sale',
  'cuanto cuesta',
  'presupuesto',
  'comprar',
  'contratar',
  'reunion',
  'llamame',
  'llamar',
  'asesor',
  'coordinar',
];

function isOptOutMessage(text: string): boolean {
  const norm = normalizeText(text);
  return OPT_OUT_PHRASES.some((phrase) => containsWholePhrase(norm, phrase));
}

function hasCommercialHandoffIntent(
  text: string,
  configuredKeywords: string[]
): boolean {
  const norm = normalizeText(text);
  const allKeywords = [...configuredKeywords, ...COMMERCIAL_INTENT_PHRASES];
  return allKeywords.some((kw) => containsWholePhrase(norm, kw));
}

function countConsecutiveAiTurnsSinceHuman(history: Message[]): number {
  let aiTurns = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.sender_type === 'HUMAN_OWNER') {
      break;
    }
    if (msg.direction === 'OUTBOUND' && msg.sender_type === 'AI_AGENT') {
      aiTurns++;
    }
  }
  return aiTurns;
}

export class AIRetentionEngine {
  private readonly dataStore: IWorkerDataStore;
  private readonly llmProvider: ILLMProvider;
  private readonly alertNotifier: IOwnerAlertNotifier;
  private readonly dashboardBaseUrl: string;
  private readonly defaultThinkingLevel: AIThinkingLevel;
  private readonly enqueueOutboundJob?: AIRetentionEngineDeps['enqueueOutboundJob'];
  private readonly onRealtimeEvent?: AIRetentionEngineDeps['onRealtimeEvent'];

  constructor(deps: AIRetentionEngineDeps) {
    this.dataStore = deps.dataStore;
    this.llmProvider = deps.llmProvider;
    this.alertNotifier = deps.alertNotifier;
    this.dashboardBaseUrl = (
      deps.dashboardBaseUrl || env.DASHBOARD_BASE_URL
    ).replace(/\/+$/, '');
    this.defaultThinkingLevel = deps.defaultThinkingLevel ?? env.AI_THINKING_LEVEL;
    this.enqueueOutboundJob = deps.enqueueOutboundJob;
    this.onRealtimeEvent = deps.onRealtimeEvent;
  }

  async processInboundMessage(params: {
    contactId: string;
    inboundMessageText: string;
    now?: Date;
  }): Promise<AIRetentionDecision> {
    const now = params.now ?? new Date();
    const aiConfig = await this.dataStore.getAIConfig();
    let contact = await this.dataStore.getContactById(params.contactId);

    if (!contact) {
      throw new Error(`Contacto ${params.contactId} no encontrado`);
    }

    // 1. Si el silencio temporal de HUMAN_TAKEOVER ya venció, reactivar AI_RETENTION
    if (
      contact.ai_mode === 'HUMAN_TAKEOVER' &&
      contact.ai_muted_until &&
      contact.ai_muted_until.getTime() <= now.getTime()
    ) {
      contact =
        (await this.dataStore.updateContactMode(
          contact.id,
          'AI_RETENTION',
          null
        )) ?? contact;
    }

    // 2. Si la IA global está apagada o el contacto está en HUMAN_TAKEOVER / MUTED, silencio total
    if (!aiConfig.is_global_enabled || contact.ai_mode !== 'AI_RETENTION') {
      return {
        shouldReply: false,
        replyText: null,
        escalated: false,
        escalationReason: null,
        nextMode: contact.ai_mode,
        mutedUntil: contact.ai_muted_until,
        alertPayload: null,
      };
    }

    const contactName =
      contact.address_book_name ||
      contact.push_name ||
      contact.phone_number ||
      'Cliente';
    const history = await this.dataStore.listMessagesByContact(contact.id, 30);

    // 3. Higiene de Opt-Out / Baja (David Cancel Conversational Marketing)
    if (isOptOutMessage(params.inboundMessageText)) {
      await this.dataStore.updateContactMode(contact.id, 'MUTED', null);
      const summary = await this.llmProvider.summarizeConversationTwoLines(
        history,
        params.inboundMessageText,
        contactName
      );
      const alertPayload = this.buildAlertPayload(
        contact,
        contactName,
        'OPT_OUT_REQUEST',
        summary,
        now
      );
      await this.alertNotifier.sendOwnerAlert(
        alertPayload,
        aiConfig.alert_webhook_url
      );
      await this.dataStore.updateContactMetadata(contact.id, {
        last_ai_alert: alertPayload,
      });

      return {
        shouldReply: false,
        replyText: null,
        escalated: true,
        escalationReason: 'OPT_OUT_REQUEST',
        nextMode: 'MUTED',
        mutedUntil: null,
        alertPayload,
      };
    }

    // 4. Inferencia Estructurada (Gemini 3.8 High o proveedor configurado) + Reglas Escalado
    const thinkingLevel = aiConfig.thinking_level ?? this.defaultThinkingLevel;
    let structuredDecision: StructuredRetentionOutput | null = null;
    let rawReply: string;

    if (this.llmProvider.generateStructuredRetentionDecision) {
      structuredDecision =
        await this.llmProvider.generateStructuredRetentionDecision({
          systemPrompt: aiConfig.system_prompt,
          history,
          userMessage: params.inboundMessageText,
          contactName,
          modelName: aiConfig.model_name,
          thinkingLevel,
        });
      rawReply = structuredDecision.replyText;

      if (structuredDecision.usage) {
        await this.dataStore.recordAIUsage?.({
          contact_id: contact.id,
          provider: structuredDecision.usage.provider,
          model: structuredDecision.usage.model,
          prompt_tokens: structuredDecision.usage.promptTokens,
          thought_tokens: structuredDecision.usage.thoughtTokens,
          output_tokens: structuredDecision.usage.outputTokens,
          latency_ms: structuredDecision.usage.latencyMs,
          intent: structuredDecision.intent,
        });
      }

      if (
        structuredDecision.intent === 'OPT_OUT' &&
        structuredDecision.confidence >= 0.85
      ) {
        await this.dataStore.updateContactMode(contact.id, 'MUTED', null);
        const alertPayload = this.buildAlertPayload(
          contact,
          contactName,
          'OPT_OUT_REQUEST',
          structuredDecision.ownerSummaryTwoLines,
          now
        );
        await this.alertNotifier.sendOwnerAlert(
          alertPayload,
          aiConfig.alert_webhook_url
        );
        await this.dataStore.updateContactMetadata(contact.id, {
          last_ai_alert: alertPayload,
        });
        await this.onRealtimeEvent?.({
          type: 'ai.alert',
          payload: alertPayload as unknown as Record<string, unknown>,
          timestamp: now.toISOString(),
        });

        return {
          shouldReply: false,
          replyText: null,
          escalated: true,
          escalationReason: 'OPT_OUT_REQUEST',
          nextMode: 'MUTED',
          mutedUntil: null,
          alertPayload,
        };
      }
    } else {
      rawReply = await this.llmProvider.generateRetentionReply({
        systemPrompt: aiConfig.system_prompt,
        history,
        userMessage: params.inboundMessageText,
        contactName,
        modelName: aiConfig.model_name,
        thinkingLevel,
      });
    }

    const matchedKeyword = hasCommercialHandoffIntent(
      params.inboundMessageText,
      aiConfig.handoff_keywords || []
    );

    const priorAiTurns = countConsecutiveAiTurnsSinceHuman(history);
    const nextTurnNumber = priorAiTurns + 1;
    const reachedMaxTurns = nextTurnNumber >= Math.max(1, aiConfig.max_auto_turns);

    const aiDetectedCommercial =
      structuredDecision?.intent === 'COMMERCIAL_HANDOFF' &&
      structuredDecision.confidence >= 0.75;

    let escalationReason: EscalationReason | null = null;
    if (matchedKeyword) {
      escalationReason = 'KEYWORD_MATCH';
    } else if (aiDetectedCommercial) {
      escalationReason = 'AI_INTENT_DETECTED';
    } else if (reachedMaxTurns) {
      escalationReason = 'MAX_TURNS_REACHED';
    }

    // 5. Garantizar respuesta humana de contención (sin jerga robótica ni aviso de transferencia)
    const replyText = sanitizeRoboticPhrases(rawReply);

    // 6. Encolar el mensaje saliente para que orchestrator-worker lo envíe con simulación "composing"
    const scheduledJob = await this.dataStore.createScheduledJob({
      instance_id: contact.instance_id || env.INSTANCE_NAME,
      idempotency_key: null,
      contact_id: contact.id,
      payload: {
        body: replyText,
        content_type: 'TEXT',
        sender_type: 'AI_AGENT',
        urgent: true,
      },
      scheduled_for: now,
      effective_send_at: now,
      status: 'PENDING',
    });

    const outboundMessage = await this.dataStore.createMessage({
      instance_id: contact.instance_id || env.INSTANCE_NAME,
      whatsapp_message_id: `pending_${scheduledJob.id}`,
      contact_id: contact.id,
      direction: 'OUTBOUND',
      sender_type: 'AI_AGENT',
      content_type: 'TEXT',
      body: replyText,
      media_url: null,
      media_filename: null,
      is_broadcast: false,
      status: 'QUEUED',
    });

    if (this.enqueueOutboundJob) {
      await this.enqueueOutboundJob(scheduledJob, 0);
    }

    await this.onRealtimeEvent?.({
      type: 'message.created',
      payload: { contactId: contact.id, message: outboundMessage },
      timestamp: now.toISOString(),
    });

    // 7. Si aplica escalado, disparar alerta al dueño y pasar a HUMAN_TAKEOVER de forma invisible
    if (escalationReason) {
      const muteHours =
        aiConfig.auto_mute_hours_on_human_reply ||
        env.AI_AUTO_MUTE_HOURS_ON_HUMAN_REPLY ||
        24;
      const mutedUntil = new Date(now.getTime() + muteHours * 3600 * 1000);

      await this.dataStore.updateContactMode(
        contact.id,
        'HUMAN_TAKEOVER',
        mutedUntil
      );

      const summaryTwoLines =
        structuredDecision?.ownerSummaryTwoLines ||
        (await this.llmProvider.summarizeConversationTwoLines(
          [...history, outboundMessage],
          params.inboundMessageText,
          contactName
        ));

      const alertPayload = this.buildAlertPayload(
        contact,
        contactName,
        escalationReason,
        summaryTwoLines,
        now
      );

      await this.alertNotifier.sendOwnerAlert(
        alertPayload,
        aiConfig.alert_webhook_url
      );
      await this.dataStore.updateContactMetadata(contact.id, {
        last_ai_alert: alertPayload,
      });
      await this.onRealtimeEvent?.({
        type: 'ai.alert',
        payload: alertPayload as unknown as Record<string, unknown>,
        timestamp: now.toISOString(),
      });

      return {
        shouldReply: true,
        replyText,
        escalated: true,
        escalationReason,
        nextMode: 'HUMAN_TAKEOVER',
        mutedUntil,
        alertPayload,
        scheduledJob,
        outboundMessage,
      };
    }

    return {
      shouldReply: true,
      replyText,
      escalated: false,
      escalationReason: null,
      nextMode: 'AI_RETENTION',
      mutedUntil: null,
      alertPayload: null,
      scheduledJob,
      outboundMessage,
    };
  }

  private buildAlertPayload(
    contact: Contact,
    contactName: string,
    reason: EscalationReason,
    summaryTwoLines: string,
    now: Date
  ): OwnerAlertPayload {
    return {
      contactId: contact.id,
      contactName,
      jid: contact.jid,
      phone: contact.phone_number,
      reason,
      summaryTwoLines,
      chatUrl: `${this.dashboardBaseUrl}/conversations/${contact.id}`,
      timestamp: now.toISOString(),
    };
  }
}
