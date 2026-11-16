import fs from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import type { IMessagingProvider } from '@mejoraws/shared';
import {
  EvolutionApiProvider,
  MetaCloudApiProvider,
} from '@mejoraws/shared/server';
import { env } from './config/env.js';
import type { IDataStore, IQueueDispatcher } from './domain/ports.js';
import { InMemoryDataStore } from './infrastructure/persistence/InMemoryDataStore.js';
import { InMemoryQueueDispatcher } from './infrastructure/queue/BullMQDispatcher.js';
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

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });

  fs.mkdirSync(env.UPLOADS_DIR, { recursive: true });

  await app.register(fastifyStatic, {
    root: env.UPLOADS_DIR,
    prefix: '/api/v1/media/',
    decorateReply: false,
  });

  const dataStore = deps.dataStore ?? new InMemoryDataStore();
  const queueDispatcher = deps.queueDispatcher ?? new InMemoryQueueDispatcher();

  let messagingProvider = deps.messagingProvider;
  if (!messagingProvider) {
    if (env.MESSAGING_PROVIDER === 'meta_cloud') {
      messagingProvider = new MetaCloudApiProvider({
        phoneNumberId: env.META_PHONE_NUMBER_ID,
        accessToken: env.META_ACCESS_TOKEN,
        apiVersion: env.META_API_VERSION,
        appSecret: env.META_APP_SECRET,
      });
    } else {
      messagingProvider = new EvolutionApiProvider({
        baseUrl: env.EVOLUTION_API_URL,
        apiKey: env.EVOLUTION_API_KEY,
        instanceName: env.INSTANCE_NAME,
      });
    }
  }

  await registerApiV1Routes(app, {
    dataStore,
    queueDispatcher,
    messagingProvider,
    enforceWhitelist: deps.enforceWhitelist ?? env.ENFORCE_WHITELIST,
  });

  return app;
}
