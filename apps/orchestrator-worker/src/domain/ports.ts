import type {
  AIConfig,
  AIMode,
  Contact,
  JobStatus,
  Message,
  MessageStatus,
  OwnerAlertPayload,
  ScheduledJob,
} from '@mejoraws/shared';

export interface IWorkerDataStore {
  getContactById(id: string): Promise<Contact | null>;
  getContactByJid(jid: string): Promise<Contact | null>;
  upsertContact(
    data: Partial<Contact> & { jid: string; phone_number: string }
  ): Promise<Contact>;
  updateContactMode(
    contactId: string,
    aiMode: AIMode,
    mutedUntil?: Date | null
  ): Promise<Contact | null>;
  updateContactMetadata(
    contactId: string,
    metadataPatch: Record<string, unknown>
  ): Promise<Contact | null>;

  createMessage(msg: Omit<Message, 'id' | 'created_at'>): Promise<Message>;
  updatePendingJobMessage(
    jobId: string,
    whatsappMessageId: string,
    status: MessageStatus,
    renderedBody?: string
  ): Promise<void>;
  listMessagesByContact(contactId: string, limit?: number): Promise<Message[]>;

  getScheduledJobById(id: string): Promise<ScheduledJob | null>;
  findJobByIdempotencyKey(key: string): Promise<ScheduledJob | null>;
  createScheduledJob(
    job: Omit<ScheduledJob, 'id' | 'created_at' | 'attempts' | 'error_log'>
  ): Promise<ScheduledJob>;
  updateScheduledJob(
    id: string,
    patch: Partial<
      Pick<
        ScheduledJob,
        | 'scheduled_for'
        | 'effective_send_at'
        | 'status'
        | 'attempts'
        | 'error_log'
      >
    >
  ): Promise<ScheduledJob | null>;
  listScheduledJobsByStatus(status: JobStatus): Promise<ScheduledJob[]>;

  getAIConfig(): Promise<AIConfig>;
}

export interface ISentCacheAndLimiter {
  isQueuePaused(): Promise<boolean>;
  setQueuePaused(paused: boolean): Promise<boolean>;
  markMessageSentBySystem(
    whatsappMessageId: string,
    ttlSeconds?: number
  ): Promise<void>;
  wasMessageSentBySystem(whatsappMessageId: string): Promise<boolean>;
  acquireIdempotencyLock(
    idempotencyKey: string,
    ttlSeconds?: number
  ): Promise<boolean>;
  incrementAndCheckHourlyLimit(
    maxMessagesPerHour: number,
    now?: Date
  ): Promise<{ allowed: boolean; currentCount: number }>;
}

export interface LLMCompletionParams {
  systemPrompt: string;
  history: Message[];
  userMessage: string;
  contactName: string;
  modelName?: string;
}

export interface ILLMProvider {
  generateRetentionReply(params: LLMCompletionParams): Promise<string>;
  summarizeConversationTwoLines(
    history: Message[],
    latestUserMessage: string,
    contactName: string
  ): Promise<string>;
}

export interface IOwnerAlertNotifier {
  sendOwnerAlert(
    alert: OwnerAlertPayload,
    webhookUrlOverride?: string | null
  ): Promise<boolean>;
}
