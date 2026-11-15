import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import type { IMessagingProvider } from '@mejoraws/shared';
import { env } from './config/env.js';
import type { IDataStore, IQueueDispatcher } from './domain/ports.js';
import { InMemoryDataStore } from './infrastructure/persistence/InMemoryDataStore.js';
import { InMemoryQueueDispatcher } from './infrastructure/queue/BullMQDispatcher.js';
import { EvolutionApiProvider } from './infrastructure/providers/EvolutionApiProvider.js';
import { registerApiV1Routes } from './presentation/routes/apiV1Routes.js';

export interface BuildAppDeps {
  dataStore?: IDataStore;
  queueDispatcher?: IQueueDispatcher;
  messagingProvider?: IMessagingProvider;
  enforceWhitelist?: boolean;
  logger?: boolean;
}

export async function buildApp(
  deps: BuildAppDeps = {}
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.logger ?? false,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(jwt, {
    secret: env.JWT_SECRET,
  });

  const dataStore = deps.dataStore ?? new InMemoryDataStore();
  const queueDispatcher = deps.queueDispatcher ?? new InMemoryQueueDispatcher();
  const messagingProvider =
    deps.messagingProvider ??
    new EvolutionApiProvider({
      baseUrl: env.EVOLUTION_API_URL,
      apiKey: env.EVOLUTION_API_KEY,
      instanceName: env.INSTANCE_NAME,
    });

  await registerApiV1Routes(app, {
    dataStore,
    queueDispatcher,
    messagingProvider,
    enforceWhitelist: deps.enforceWhitelist ?? env.ENFORCE_WHITELIST,
  });

  return app;
}
