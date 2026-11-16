import { fileURLToPath } from 'node:url';
import { Queue, Worker, type Job } from 'bullmq';
import type { IMessagingProvider } from '@mejoraws/shared';
import { MetaCloudApiProvider } from '@mejoraws/shared/server';
import { env } from './config/env.js';
import type {
  ISentCacheAndLimiter,
  IWorkerDataStore,
} from './domain/ports.js';
import { EvolutionApiProvider } from './infrastructure/providers/EvolutionApiProvider.js';
import {
  InMemorySentCacheAndLimiter,
  RedisSentCacheAndLimiter,
} from './infrastructure/cache/SentCacheAndLimiter.js';
import {
  InMemoryWorkerStore,
  PostgresWorkerStore,
} from './infrastructure/persistence/WorkerDataStore.js';
import {
  MultiProviderLLMAdapter,
  OwnerWebhookNotifier,
} from './infrastructure/ai/MultiProviderLLMAdapter.js';
import { AIRetentionEngine } from './application/AIRetentionEngine.js';
import { OutboundMessageProcessor } from './application/OutboundMessageProcessor.js';

export const OUTBOUND_QUEUE_NAME = 'outbound_messages';
export const INBOUND_AI_QUEUE_NAME = 'inbound_ai_events';

export interface OutboundBullJobData {
  jobId: string;
  contactId: string;
  payload: {
    body: string;
    media_url?: string;
    media_filename?: string;
    content_type?: string;
    sender_type?: string;
    urgent?: boolean;
  };
  idempotencyKey?: string | null;
}

export interface InboundAIBullJobData {
  contactId: string;
  inboundMessageText: string;
  receivedAtIso?: string;
}

export {
  env,
  EvolutionApiProvider,
  MetaCloudApiProvider,
  RedisSentCacheAndLimiter,
  InMemorySentCacheAndLimiter,
  PostgresWorkerStore,
  InMemoryWorkerStore,
  MultiProviderLLMAdapter,
  OwnerWebhookNotifier,
  AIRetentionEngine,
  OutboundMessageProcessor,
};

function createMessagingProviderFromEnv(): IMessagingProvider {
  if (env.MESSAGING_PROVIDER === 'meta_cloud') {
    return new MetaCloudApiProvider({
      phoneNumberId: env.META_PHONE_NUMBER_ID,
      accessToken: env.META_ACCESS_TOKEN,
      apiVersion: env.META_API_VERSION,
      instanceName: env.INSTANCE_NAME,
    });
  }
  return new EvolutionApiProvider({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instanceName: env.INSTANCE_NAME,
  });
}

export async function bootstrapWorker(): Promise<void> {
  let dataStore: IWorkerDataStore;
  let sentCache: ISentCacheAndLimiter;
  let redisLimiter: RedisSentCacheAndLimiter | null = null;

  const pgStore = new PostgresWorkerStore(env.DATABASE_URL);
  try {
    await pgStore.testConnection();
    dataStore = pgStore;
    console.log('[orchestrator-worker] Conectado a PostgreSQL 16');
  } catch (err) {
    await pgStore.close().catch(() => {});
    console.warn(
      '[orchestrator-worker] PostgreSQL no disponible, usando InMemoryWorkerStore de respaldo:',
      err instanceof Error ? err.message : err
    );
    dataStore = new InMemoryWorkerStore();
  }

  const candidateRedis = new RedisSentCacheAndLimiter(env.REDIS_URL);
  try {
    await candidateRedis.connect();
    sentCache = candidateRedis;
    redisLimiter = candidateRedis;
    console.log('[orchestrator-worker] Conectado a Redis 7');
  } catch (err) {
    await candidateRedis.close().catch(() => {});
    console.warn(
      '[orchestrator-worker] Redis no disponible, usando InMemorySentCacheAndLimiter de respaldo:',
      err instanceof Error ? err.message : err
    );
    sentCache = new InMemorySentCacheAndLimiter();
  }

  const messagingProvider = createMessagingProviderFromEnv();
  const publishEvent = redisLimiter
    ? (ev: Parameters<RedisSentCacheAndLimiter['publishRealtimeEvent']>[0]) =>
        redisLimiter!.publishRealtimeEvent(ev)
    : undefined;

  const processor = new OutboundMessageProcessor({
    dataStore,
    sentCache,
    messagingProvider,
    enforceWhitelist: env.ENFORCE_WHITELIST,
    safeHoursStart: env.SAFE_HOURS_START,
    safeHoursEnd: env.SAFE_HOURS_END,
    timeZone: env.TZ,
    maxMessagesPerHour: env.MAX_MESSAGES_PER_HOUR,
    onRealtimeEvent: publishEvent,
  });

  if (!redisLimiter) {
    console.warn(
      '[orchestrator-worker] Worker iniciado en modo pasivo local (sin conexión Redis activa para BullMQ).'
    );
    return;
  }

  const outboundQueue = new Queue<OutboundBullJobData>(OUTBOUND_QUEUE_NAME, {
    connection: redisLimiter.getConnection(),
  });

  const aiEngine = new AIRetentionEngine({
    dataStore,
    llmProvider: new MultiProviderLLMAdapter(),
    alertNotifier: new OwnerWebhookNotifier(),
    dashboardBaseUrl: env.DASHBOARD_BASE_URL,
    defaultThinkingLevel: env.AI_THINKING_LEVEL,
    enqueueOutboundJob: async (job, delayMs) => {
      await outboundQueue.add(
        'dispatch_message',
        {
          jobId: job.id,
          contactId: job.contact_id,
          payload: job.payload,
          idempotencyKey: job.idempotency_key,
        },
        {
          jobId: job.id,
          delay: Math.max(0, Math.round(delayMs)),
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 500,
          removeOnFail: 500,
        }
      );
    },
    onRealtimeEvent: publishEvent,
  });

  const outboundWorker = new Worker<OutboundBullJobData>(
    OUTBOUND_QUEUE_NAME,
    async (bullJob: Job<OutboundBullJobData>) => {
      const targetJobId = String(bullJob.data.jobId || bullJob.id);
      return processor.processJob(targetJobId);
    },
    {
      connection: redisLimiter.getConnection(),
      concurrency: 1,
    }
  );

  const inboundAIWorker = new Worker<InboundAIBullJobData>(
    INBOUND_AI_QUEUE_NAME,
    async (bullJob: Job<InboundAIBullJobData>) => {
      return aiEngine.processInboundMessage({
        contactId: bullJob.data.contactId,
        inboundMessageText: bullJob.data.inboundMessageText,
        now: bullJob.data.receivedAtIso
          ? new Date(bullJob.data.receivedAtIso)
          : new Date(),
      });
    },
    {
      connection: redisLimiter.getConnection(),
      concurrency: 3,
    }
  );

  outboundWorker.on('completed', (job, result) => {
    console.log(
      `[orchestrator-worker] Salida ${job.id} procesada:`,
      JSON.stringify(result)
    );
  });

  outboundWorker.on('failed', (job, err) => {
    console.error(
      `[orchestrator-worker] Fallo en salida ${job?.id}:`,
      err.message
    );
  });

  inboundAIWorker.on('completed', (job, result) => {
    console.log(
      `[orchestrator-worker] IA Inbound ${job.id} resuelta (shouldReply=${result.shouldReply}, escalated=${result.escalated})`
    );
  });

  inboundAIWorker.on('failed', (job, err) => {
    console.error(
      `[orchestrator-worker] Fallo en IA Inbound ${job?.id}:`,
      err.message
    );
  });

  const shutdown = async () => {
    console.log('[orchestrator-worker] Cerrando consumidores BullMQ...');
    await outboundWorker.close().catch(() => {});
    await inboundAIWorker.close().catch(() => {});
    await outboundQueue.close().catch(() => {});
    await redisLimiter?.close().catch(() => {});
    await pgStore.close().catch(() => {});
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(
    `[orchestrator-worker] Escuchando "${OUTBOUND_QUEUE_NAME}" + "${INBOUND_AI_QUEUE_NAME}" (provider=${env.MESSAGING_PROVIDER}, ai=${env.AI_PROVIDER}/${env.AI_MODEL}:${env.AI_THINKING_LEVEL})`
  );
}

const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() ===
    process.argv[1].toLowerCase();

if (isMainModule) {
  bootstrapWorker().catch((err) => {
    console.error('[orchestrator-worker] Error fatal al iniciar:', err);
    process.exit(1);
  });
}
