import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  formatToJid,
  type ConnectionStatusResult,
  type IMessagingProvider,
  type OutboundMessageContent,
  type SendResult,
} from '@mejoraws/shared';
import { buildApp } from '../app.js';
import { env } from '../config/env.js';
import { InMemoryDataStore } from '../infrastructure/persistence/InMemoryDataStore.js';
import { InMemoryQueueDispatcher } from '../infrastructure/queue/BullMQDispatcher.js';

function createMockMessagingProvider(): IMessagingProvider {
  return {
    sendMessage: vi.fn(
      async (_jid: string, _content: OutboundMessageContent): Promise<SendResult> => ({
        messageId: `evo_mock_${Date.now()}`,
        status: 'SENT',
        timestamp: new Date(),
      })
    ),
    sendPresenceUpdate: vi.fn(async () => undefined),
    presenceSubscribe: vi.fn(async () => undefined),
    syncContacts: vi.fn(async () => []),
    getConnectionStatus: vi.fn(
      async (): Promise<ConnectionStatusResult> => ({
        state: 'connected',
        instanceName: env.INSTANCE_NAME,
        phone: '5493764000000',
      })
    ),
  };
}

describe('Orchestrator API v1 — 2026/2027 Production Hardening & WhatsApp Coexistence', () => {
  let app: FastifyInstance;
  let dataStore: InMemoryDataStore;
  let queueDispatcher: InMemoryQueueDispatcher;
  let messagingProvider: IMessagingProvider;

  beforeEach(async () => {
    dataStore = new InMemoryDataStore();
    queueDispatcher = new InMemoryQueueDispatcher();
    messagingProvider = createMockMessagingProvider();

    app = await buildApp({
      dataStore,
      queueDispatcher,
      messagingProvider,
      enforceWhitelist: false,
      logger: false,
    });
  });

  it('1. Meta Cloud Webhook: responde al challenge en verificación GET y procesa mensaje en POST', async () => {
    // Verificación de suscripción GET
    const challengeRes = await app.inject({
      method: 'GET',
      url: `/api/v1/webhooks/meta-cloud?hub.mode=subscribe&hub.verify_token=${env.META_VERIFY_TOKEN}&hub.challenge=test_challenge_code_123`,
    });
    expect(challengeRes.statusCode).toBe(200);
    expect(challengeRes.body).toBe('test_challenge_code_123');

    // Mensaje entrante POST
    const metaWebhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/meta-cloud',
      payload: {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '5493764000000',
                    phone_number_id: 'PHONE_NUMBER_ID',
                  },
                  messages: [
                    {
                      from: '5493764358152',
                      id: 'wamid.HBgNNTQ5Mzc2NDM1ODE1MhUCABIYFDNBMEQ4NTczOTQ5',
                      timestamp: '1700000000',
                      text: {
                        body: 'Hola desde WhatsApp Cloud API Coexistence!',
                      },
                      type: 'text',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      },
    });
    expect(metaWebhookRes.statusCode).toBe(200);

    const contact = await dataStore.getContactByJid('5493764358152@s.whatsapp.net');
    expect(contact).toBeDefined();
    expect(contact?.phone_number).toBe('5493764358152');

    expect(queueDispatcher.enqueuedAIPayloads).toHaveLength(1);
    expect(queueDispatcher.enqueuedAIPayloads[0].incomingText).toBe(
      'Hola desde WhatsApp Cloud API Coexistence!'
    );
  });

  it('2. Evolution @lid Resolution: resuelve correctamente JID alternativo y almacena metadatos', async () => {
    const lidJid = '123456789012345@lid';
    const altJid = '5493765007805@s.whatsapp.net';

    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/evolution',
      payload: {
        event: 'messages.upsert',
        instance: env.INSTANCE_NAME,
        data: {
          key: {
            remoteJid: lidJid,
            remoteJidAlt: altJid,
            fromMe: false,
            id: 'EVO_MSG_LID_001',
          },
          pushName: 'Usuario Multi-Device LID',
          message: {
            conversation: 'Consulta enviada desde dispositivo multi-device',
          },
        },
      },
    });
    expect(webhookRes.statusCode).toBe(200);

    // Debe resolver al JID canónico con número de teléfono
    const contact = await dataStore.getContactByJid(altJid);
    expect(contact).toBeDefined();
    expect(contact?.phone_number).toBe('5493765007805');
    expect(contact?.push_name).toBe('Usuario Multi-Device LID');
    expect(contact?.metadata?.lid).toBe(lidJid);
  });

  it('3. Pre-flight Inflight Lock: previene falso HUMAN_TAKEOVER cuando hay un envío en curso', async () => {
    const targetJid = formatToJid('3764358152');
    const contact = await dataStore.upsertContact({
      jid: targetJid,
      phone_number: '5493764358152',
      ai_mode: 'AI_RETENTION',
      is_whitelisted: true,
    });

    // Simulamos que el sistema acaba de despachar un mensaje y colocó el pre-flight lock
    await queueDispatcher.markOutboundInflight(targetJid, 30);
    expect(await queueDispatcher.hasOutboundInflight(targetJid)).toBe(true);

    // Llega webhook de Evolution con fromMe: true antes de registrar el messageId en sent_cache
    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/webhooks/evolution',
      payload: {
        event: 'messages.upsert',
        instance: env.INSTANCE_NAME,
        data: {
          key: {
            remoteJid: targetJid,
            fromMe: true,
            id: 'EVO_FAST_ECHO_MSG_001',
          },
          message: {
            conversation: 'Eco veloz de WhatsApp antes de que el worker reciba el ID',
          },
        },
      },
    });
    expect(webhookRes.statusCode).toBe(200);

    // El contacto DEBE permanecer en AI_RETENTION (NO cambiar a HUMAN_TAKEOVER)
    const refreshed = await dataStore.getContactById(contact.id);
    expect(refreshed?.ai_mode).toBe('AI_RETENTION');
    expect(refreshed?.ai_muted_until).toBeNull();
  });
});
