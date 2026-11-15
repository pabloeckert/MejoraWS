import {
  calculateTypingDurationMs,
  clampDateToSafeHours,
  isWithinSafeHours,
  parseSpintax,
  renderTemplate,
  type ContentType,
  type IMessagingProvider,
} from '@mejoraws/shared';
import type {
  ISentCacheAndLimiter,
  IWorkerDataStore,
} from '../domain/ports.js';
import { env } from '../config/env.js';

export type OutboundProcessOutcome =
  | 'SENT'
  | 'SKIPPED_QUEUE_PAUSED'
  | 'SKIPPED_CANCELLED'
  | 'SKIPPED_DUPLICATE_IDEMPOTENCY'
  | 'RESCHEDULED_SAFE_HOURS'
  | 'DEFERRED_RATE_LIMIT'
  | 'BLOCKED_WHITELIST';

export interface OutboundProcessResult {
  outcome: OutboundProcessOutcome;
  jobId: string;
  whatsappMessageId?: string;
  typingDurationMs?: number;
  renderedText?: string;
  rescheduledFor?: Date;
}

export interface OutboundMessageProcessorDeps {
  dataStore: IWorkerDataStore;
  sentCache: ISentCacheAndLimiter;
  messagingProvider: IMessagingProvider;
  enforceWhitelist?: boolean;
  safeHoursStart?: string;
  safeHoursEnd?: string;
  maxMessagesPerHour?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class OutboundMessageProcessor {
  private readonly dataStore: IWorkerDataStore;
  private readonly sentCache: ISentCacheAndLimiter;
  private readonly messagingProvider: IMessagingProvider;
  private readonly enforceWhitelist: boolean;
  private readonly safeHoursStart: string;
  private readonly safeHoursEnd: string;
  private readonly maxMessagesPerHour: number;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(deps: OutboundMessageProcessorDeps) {
    this.dataStore = deps.dataStore;
    this.sentCache = deps.sentCache;
    this.messagingProvider = deps.messagingProvider;
    this.enforceWhitelist = deps.enforceWhitelist ?? env.ENFORCE_WHITELIST;
    this.safeHoursStart = deps.safeHoursStart ?? env.SAFE_HOURS_START;
    this.safeHoursEnd = deps.safeHoursEnd ?? env.SAFE_HOURS_END;
    this.maxMessagesPerHour =
      deps.maxMessagesPerHour ?? env.MAX_MESSAGES_PER_HOUR;
    this.sleepFn = deps.sleepFn ?? defaultSleep;
  }

  async processJob(
    jobId: string,
    now = new Date()
  ): Promise<OutboundProcessResult> {
    // 1. Verificar botón de pánico global (Queue Paused)
    if (await this.sentCache.isQueuePaused()) {
      return {
        outcome: 'SKIPPED_QUEUE_PAUSED',
        jobId,
      };
    }

    const job = await this.dataStore.getScheduledJobById(jobId);
    if (!job) {
      throw new Error(`ScheduledJob ${jobId} no existe en la base de datos`);
    }

    if (job.status === 'CANCELLED') {
      return {
        outcome: 'SKIPPED_CANCELLED',
        jobId,
      };
    }

    if (job.status === 'COMPLETED') {
      return {
        outcome: 'SKIPPED_DUPLICATE_IDEMPOTENCY',
        jobId,
      };
    }

    // 2. Bloqueo de Idempotencia (Husnain Bukhari / Twilio Engineering)
    if (job.idempotency_key) {
      const acquired = await this.sentCache.acquireIdempotencyLock(
        job.idempotency_key
      );
      if (!acquired) {
        return {
          outcome: 'SKIPPED_DUPLICATE_IDEMPOTENCY',
          jobId,
        };
      }
    }

    const contact = await this.dataStore.getContactById(job.contact_id);
    if (!contact) {
      await this.dataStore.updateScheduledJob(job.id, {
        status: 'FAILED',
        error_log: 'Contacto destino inexistente',
      });
      throw new Error(`Contacto ${job.contact_id} no encontrado`);
    }

    // 3. Cortafuegos Whitelist (PRD § 4.3)
    if (this.enforceWhitelist && !contact.is_whitelisted) {
      await this.dataStore.updateScheduledJob(job.id, {
        status: 'FAILED',
        error_log:
          'Bloqueado por cortafuegos ENFORCE_WHITELIST=true (contacto no autorizado)',
      });
      await this.dataStore.updatePendingJobMessage(
        job.id,
        `blocked_${job.id}`,
        'FAILED'
      );
      return {
        outcome: 'BLOCKED_WHITELIST',
        jobId: job.id,
      };
    }

    // 4. Ventana Horaria Segura SAFE_HOURS (PRD § 4.1) salvo urgent: true
    if (
      !job.payload.urgent &&
      !isWithinSafeHours(now, this.safeHoursStart, this.safeHoursEnd)
    ) {
      const nextSafeDate = clampDateToSafeHours(
        now,
        this.safeHoursStart,
        this.safeHoursEnd
      );
      await this.dataStore.updateScheduledJob(job.id, {
        effective_send_at: nextSafeDate,
        status: 'PENDING',
      });
      return {
        outcome: 'RESCHEDULED_SAFE_HOURS',
        jobId: job.id,
        rescheduledFor: nextSafeDate,
      };
    }

    // 5. Control de Rate Limit Horario
    const rateCheck = await this.sentCache.incrementAndCheckHourlyLimit(
      this.maxMessagesPerHour,
      now
    );
    if (!rateCheck.allowed) {
      return {
        outcome: 'DEFERRED_RATE_LIMIT',
        jobId: job.id,
      };
    }

    await this.dataStore.updateScheduledJob(job.id, {
      status: 'PROCESSING',
      attempts: (job.attempts || 0) + 1,
    });

    try {
      // 6. Resolución de Plantilla y Spintax Polimórfico
      const contactDisplayName =
        contact.address_book_name ||
        contact.push_name ||
        contact.phone_number ||
        '';
      const customVariable =
        (contact.metadata?.variable as string) ||
        (contact.metadata?.empresa as string) ||
        '';
      const templated = renderTemplate(job.payload.body || '', {
        nombre: contactDisplayName,
        name: contactDisplayName,
        telefono: contact.phone_number,
        phone: contact.phone_number,
        variable: customVariable,
        empresa: customVariable,
      });
      const renderedText = parseSpintax(templated);

      // 7. Simulación de Presencia Humana "composing" 1.5s a 4.0s (PRD § 4.2)
      const typingDurationMs = calculateTypingDurationMs(renderedText.length);
      await this.messagingProvider.presenceSubscribe(contact.jid);
      await this.messagingProvider.sendPresenceUpdate(contact.jid, 'composing');
      await this.sleepFn(typingDurationMs);
      await this.messagingProvider.sendPresenceUpdate(contact.jid, 'paused');

      // 8. Envío físico a través de IMessagingProvider (Evolution API v2)
      const contentType: ContentType =
        job.payload.content_type ||
        (/https?:\/\/\S+/i.test(renderedText) ? 'URL' : 'TEXT');

      const sendResult = await this.messagingProvider.sendMessage(contact.jid, {
        text: renderedText,
        mediaUrl: job.payload.media_url,
        mediaFilename: job.payload.media_filename,
        contentType,
        linkPreview: true,
      });

      // 9. Registro inmediato en sent_cache para Salvaguarda de Celular Físico (PRD § 3)
      await this.sentCache.markMessageSentBySystem(sendResult.messageId);

      // 10. Persistir trazabilidad final en messages y scheduled_jobs
      await this.dataStore.updatePendingJobMessage(
        job.id,
        sendResult.messageId,
        sendResult.status,
        renderedText
      );

      await this.dataStore.updateScheduledJob(job.id, {
        status: 'COMPLETED',
        error_log: null,
      });

      return {
        outcome: 'SENT',
        jobId: job.id,
        whatsappMessageId: sendResult.messageId,
        typingDurationMs,
        renderedText,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await this.dataStore.updateScheduledJob(job.id, {
        status: 'FAILED',
        error_log: errorMessage,
      });
      await this.dataStore.updatePendingJobMessage(
        job.id,
        `failed_${job.id}`,
        'FAILED'
      );
      throw err;
    }
  }
}
