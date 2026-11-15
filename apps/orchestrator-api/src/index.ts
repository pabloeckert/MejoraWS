import { env } from './config/env.js';
import { buildApp } from './app.js';
import type { IDataStore, IQueueDispatcher } from './domain/ports.js';
import { PostgresDataStore } from './infrastructure/persistence/PostgresDataStore.js';
import { InMemoryDataStore } from './infrastructure/persistence/InMemoryDataStore.js';
import {
  BullMQDispatcher,
  InMemoryQueueDispatcher,
} from './infrastructure/queue/BullMQDispatcher.js';
import { EvolutionApiProvider } from './infrastructure/providers/EvolutionApiProvider.js';

async function bootstrap() {
  let dataStore: IDataStore;
  let queueDispatcher: IQueueDispatcher;

  const pgStore = new PostgresDataStore(env.DATABASE_URL);
  try {
    await pgStore.testConnection();
    dataStore = pgStore;
    console.log('[orchestrator-api] Conectado a PostgreSQL 16');
  } catch (err) {
    await pgStore.close().catch(() => {});
    console.warn(
      '[orchestrator-api] PostgreSQL no disponible, usando InMemoryDataStore de respaldo:',
      err instanceof Error ? err.message : err
    );
    dataStore = new InMemoryDataStore();
  }

  const bullDispatcher = new BullMQDispatcher(env.REDIS_URL);
  try {
    await bullDispatcher.connect();
    queueDispatcher = bullDispatcher;
    console.log('[orchestrator-api] Conectado a Redis + BullMQ');
  } catch (err) {
    await bullDispatcher.close().catch(() => {});
    console.warn(
      '[orchestrator-api] Redis no disponible, usando InMemoryQueueDispatcher de respaldo:',
      err instanceof Error ? err.message : err
    );
    queueDispatcher = new InMemoryQueueDispatcher();
  }

  const messagingProvider = new EvolutionApiProvider({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instanceName: env.INSTANCE_NAME,
  });

  const app = await buildApp({
    dataStore,
    queueDispatcher,
    messagingProvider,
    enforceWhitelist: env.ENFORCE_WHITELIST,
    logger: true,
  });

  await app.listen({ port: env.APP_PORT, host: '0.0.0.0' });
  console.log(
    `[orchestrator-api] Escuchando en http://0.0.0.0:${env.APP_PORT}`
  );
}

bootstrap().catch((err) => {
  console.error('[orchestrator-api] Error fatal al iniciar:', err);
  process.exit(1);
});
