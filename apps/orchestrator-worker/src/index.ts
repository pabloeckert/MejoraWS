import { fileURLToPath } from 'node:url';
import { Worker, type Job } from 'bullmq';
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

export interface OutboundBullJobData {
  jobId: string;
  contactId: string;
  payload: {
    body: string;
    media_url?: string;
    media_filename?: string;
    content_type?: string;
    urgent?: boolean;
  };
  idempotencyKey?: string | null;
}

export {
  env,
  EvolutionApiProvider,
  RedisSentCacheAndLimiter,
  InMemorySentCacheAndLimiter,
  PostgresWorkerStore,
  InMemoryWorkerStore,
  MultiProviderLLMAdapter,
  OwnerWebhookNotifier,
  AIRetentionEngine,
  OutboundMessageProcessor,
};

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

  const messagingProvider = new EvolutionApiProvider({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instanceName: env.INSTANCE_NAME,
  });

  const processor = new OutboundMessageProcessor({
    dataStore,
    sentCache,
    messagingProvider,
    enforceWhitelist: env.ENFORCE_WHITELIST,
    safeHoursStart: env.SAFE_HOURS_START,
    safeHoursEnd: env.SAFE_HOURS_END,
    maxMessagesPerHour: env.MAX_MESSAGES_PER_HOUR,
  });

  if (!redisLimiter) {
    console.warn(
      '[orchestrator-worker] Worker iniciado en modo pasivo local (sin conexión Redis activa para BullMQ).'
    );
    return;
  }

  const bullWorker = new Worker<OutboundBullJobData>(
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

  bullWorker.on('completed', (job, result) => {
    console.log(
      `[orchestrator-worker] Trabajo ${job.id} procesado:`,
      JSON.stringify(result)
    );
  });

  bullWorker.on('failed', (job, err) => {
    console.error(
      `[orchestrator-worker] Fallo en trabajo ${job?.id}:`,
      err.message
    );
  });

  const shutdown = async () => {
    console.log('[orchestrator-worker] Cerrando consumidor BullMQ...');
    await bullWorker.close().catch(() => {});
    await redisLimiter?.close().catch(() => {});
    await pgStore.close().catch(() => {});
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(
    `[orchestrator-worker] Escuchando cola "${OUTBOUND_QUEUE_NAME}" (concurrency=1, instance=${env.INSTANCE_NAME})`
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
