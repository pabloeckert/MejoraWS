import type {
  AIConfig,
  AIMode,
  ApiKey,
  Contact,
  JobStatus,
  Message,
  MessageStatus,
  ScheduledJob,
} from '@mejoraws/shared';

export interface DailyMetrics {
  sentToday: number;
  receivedToday: number;
  pendingJobs: number;
  failedToday: number;
}

export interface ContactListFilters {
  isInBroadcast?: boolean;
  aiMode?: AIMode;
  search?: string;
}

export interface IDataStore {
  upsertContact(
    data: Partial<Contact> & { jid: string; phone_number: string }
  ): Promise<Contact>;
  getContactById(id: string): Promise<Contact | null>;
  getContactByJid(jid: string): Promise<Contact | null>;
  listContacts(filters?: ContactListFilters): Promise<Contact[]>;
  updateContactMode(
    contactId: string,
    aiMode: AIMode,
    mutedUntil?: Date | null
  ): Promise<Contact | null>;
  updateContactWhitelist(
    contactId: string,
    isWhitelisted: boolean
  ): Promise<Contact | null>;

  createMessage(msg: Omit<Message, 'id' | 'created_at'>): Promise<Message>;
  updateMessageStatus(
    whatsappMessageId: string,
    status: MessageStatus
  ): Promise<void>;
  listMessagesByContact(contactId: string, limit?: number): Promise<Message[]>;

  findJobByIdempotencyKey(key: string): Promise<ScheduledJob | null>;
  getScheduledJobById(id: string): Promise<ScheduledJob | null>;
  createScheduledJob(
    job: Omit<ScheduledJob, 'id' | 'created_at' | 'attempts' | 'error_log'>
  ): Promise<ScheduledJob>;
  listScheduledJobs(status?: JobStatus): Promise<ScheduledJob[]>;
  updateScheduledJob(
    id: string,
    patch: Partial<
      Pick<
        ScheduledJob,
        'scheduled_for' | 'effective_send_at' | 'status' | 'attempts' | 'error_log'
      >
    >
  ): Promise<ScheduledJob | null>;

  getAIConfig(): Promise<AIConfig>;
  updateAIConfig(patch: Partial<AIConfig>): Promise<AIConfig>;

  validateApiKeyHash(keyHash: string): Promise<boolean>;
  listApiKeys(): Promise<ApiKey[]>;
  createApiKey(label: string, keyHash: string): Promise<ApiKey>;

  getDailyMetrics(): Promise<DailyMetrics>;
}

export interface IQueueDispatcher {
  enqueueOutboundJob(job: ScheduledJob, delayMs: number): Promise<void>;
  cancelOutboundJob(jobId: string): Promise<void>;
  setQueuePaused(paused: boolean): Promise<boolean>;
  isQueuePaused(): Promise<boolean>;
  markMessageSentBySystem(
    whatsappMessageId: string,
    ttlSeconds?: number
  ): Promise<void>;
  wasMessageSentBySystem(whatsappMessageId: string): Promise<boolean>;
}
