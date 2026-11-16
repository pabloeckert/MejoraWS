import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  formatToJid,
  normalizePhone,
  resolveEvolutionRemoteTarget,
  sanitizeRoboticPhrases,
  type AIMode,
  type AIThinkingLevel,
  type ContentType,
  type EscalationReason,
  type IMessagingProvider,
  type JobStatus,
  type Message,
  type MessageStatus,
  type OwnerAlertPayload,
  type RealtimeEvent,
  type ScheduledJob,
} from '@mejoraws/shared';
import { verifyMetaWebhookSignature } from '@mejoraws/shared/server';
import { env } from '../../config/env.js';
import type { IDataStore, IQueueDispatcher } from '../../domain/ports.js';
import { SmartDripCalculator } from '../../application/SmartDripCalculator.js';
import {
  AUTH_COOKIE_NAME,
  createAuthMiddleware,
  hashApiKey,
  timingSafeStringCompare,
} from '../middleware/auth.js';

export interface RouteDependencies {
  dataStore: IDataStore;
  queueDispatcher: IQueueDispatcher;
  messagingProvider: IMessagingProvider;
  enforceWhitelist: boolean;
}

const contentTypeEnum = z.enum([
  'TEXT',
  'IMAGE',
  'PDF',
  'DOCUMENT',
  'URL',
  'BROADCAST_CAPTURE',
]);

const aiModeEnum = z.enum(['AI_RETENTION', 'HUMAN_TAKEOVER', 'MUTED']);
const thinkingLevelEnum = z.enum(['low', 'medium', 'high', 'xhigh']);

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const sendMessageSchema = z
  .object({
    contactId: z.string().optional(),
    phone: z.string().optional(),
    jid: z.string().optional(),
    text: z.string().optional(),
    mediaUrl: z.string().optional(),
    mediaFilename: z.string().optional(),
    contentType: contentTypeEnum.optional().default('TEXT'),
    idempotency_key: z.string().min(1).optional(),
    urgent: z.boolean().optional().default(false),
  })
  .refine((d) => Boolean(d.contactId || d.phone || d.jid), {
    message: 'Debe proporcionar contactId, phone o jid',
  });

const scheduleMessageSchema = z
  .object({
    contactId: z.string().optional(),
    contactIds: z.array(z.string()).optional(),
    phone: z.string().optional(),
    phones: z.array(z.string()).optional(),
    jid: z.string().optional(),
    text: z.string().optional(),
    mediaUrl: z.string().optional(),
    mediaFilename: z.string().optional(),
    contentType: contentTypeEnum.optional().default('TEXT'),
    scheduledFor: z.string().datetime({ offset: true }).or(z.string().min(1)),
    idempotency_key: z.string().min(1).optional(),
    urgent: z.boolean().optional().default(false),
  })
  .refine(
    (d) =>
      Boolean(
        d.contactId ||
          d.contactIds?.length ||
          d.phone ||
          d.phones?.length ||
          d.jid
      ),
    { message: 'Debe proporcionar al menos un contacto o teléfono destino' }
  );

const updateScheduledJobSchema = z.object({
  scheduledFor: z.string().min(1).optional(),
  status: z.enum(['PENDING', 'CANCELLED']).optional(),
});

const createContactSchema = z.object({
  phone: z.string().min(5),
  name: z.string().optional(),
  is_whitelisted: z.boolean().optional().default(false),
});

const whitelistSchema = z.object({
  is_whitelisted: z.boolean(),
});

const conversationModeSchema = z.object({
  mode: aiModeEnum,
  muteHours: z.number().int().positive().optional(),
});

const manualReplySchema = z.object({
  text: z.string().optional(),
  mediaUrl: z.string().optional(),
  mediaFilename: z.string().optional(),
  contentType: contentTypeEnum.optional().default('TEXT'),
});

const aiConfigPatchSchema = z.object({
  is_global_enabled: z.boolean().optional(),
  system_prompt: z.string().min(1).optional(),
  model_name: z.string().min(1).optional(),
  thinking_level: thinkingLevelEnum.optional(),
  max_auto_turns: z.number().int().min(1).max(20).optional(),
  handoff_keywords: z.array(z.string()).optional(),
  auto_mute_hours_on_human_reply: z.number().int().min(1).max(168).optional(),
  alert_webhook_url: z.string().nullable().optional(),
});

function extractEvolutionText(msgObj: Record<string, unknown> | undefined): {
  text: string;
  contentType: ContentType;
  mediaUrl: string | null;
  mediaFilename: string | null;
} {
  if (!msgObj) {
    return { text: '', contentType: 'TEXT', mediaUrl: null, mediaFilename: null };
  }

  if (typeof msgObj.conversation === 'string') {
    const hasUrl = /https?:\/\/\S+/i.test(msgObj.conversation);
    return {
      text: msgObj.conversation,
      contentType: hasUrl ? 'URL' : 'TEXT',
      mediaUrl: null,
      mediaFilename: null,
    };
  }

  const ext = msgObj.extendedTextMessage as { text?: string } | undefined;
  if (ext?.text) {
    const hasUrl = /https?:\/\/\S+/i.test(ext.text);
    return {
      text: ext.text,
      contentType: hasUrl ? 'URL' : 'TEXT',
      mediaUrl: null,
      mediaFilename: null,
    };
  }

  const img = msgObj.imageMessage as
    | { caption?: string; url?: string }
    | undefined;
  if (img) {
    return {
      text: img.caption || '[Imagen]',
      contentType: 'IMAGE',
      mediaUrl: img.url || null,
      mediaFilename: null,
    };
  }

  const doc = msgObj.documentMessage as
    | { caption?: string; url?: string; fileName?: string; mimetype?: string }
    | undefined;
  if (doc) {
    const isPdf =
      (doc.mimetype || '').includes('pdf') ||
      (doc.fileName || '').toLowerCase().endsWith('.pdf');
    return {
      text: doc.caption || doc.fileName || '[Documento]',
      contentType: isPdf ? 'PDF' : 'DOCUMENT',
      mediaUrl: doc.url || null,
      mediaFilename: doc.fileName || null,
    };
  }

  return { text: '', contentType: 'TEXT', mediaUrl: null, mediaFilename: null };
}

function mapEvolutionStatus(rawStatus: unknown): MessageStatus | null {
  if (rawStatus === 2 || rawStatus === 'SERVER_ACK' || rawStatus === 'SENT') {
    return 'SENT';
  }
  if (
    rawStatus === 3 ||
    rawStatus === 'DELIVERY_ACK' ||
    rawStatus === 'DELIVERED'
  ) {
    return 'DELIVERED';
  }
  if (
    rawStatus === 4 ||
    rawStatus === 5 ||
    rawStatus === 'READ' ||
    rawStatus === 'PLAYED'
  ) {
    return 'READ';
  }
  if (rawStatus === 'FAILED' || rawStatus === 'ERROR') {
    return 'FAILED';
  }
  return null;
}

const COMMERCIAL_HANDOFF_KEYWORDS = [
  'precio',
  'costo',
  'presupuesto',
  'comprar',
  'reunion',
  'llamame',
  'asesor',
];

function normalizeForAi(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isOptOutRequest(rawText: string): boolean {
  const norm = normalizeForAi(rawText);
  return /\b(no me interesa|darme de baja|dame de baja|baja|sacame|borrame|desuscribir|no molestar|spam)\b/i.test(
    norm
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesCommercialHandoff(
  rawText: string,
  configuredKeywords: string[]
): boolean {
  const norm = normalizeForAi(rawText);
  const all = [...(configuredKeywords || []), ...COMMERCIAL_HANDOFF_KEYWORDS];
  return all.some((kw) => {
    const cleanKw = normalizeForAi(kw).trim();
    if (!cleanKw) return false;
    return new RegExp(`(?:^|\\b|\\s)${escapeRegExp(cleanKw)}(?:$|\\b|\\s)`, 'i').test(
      norm
    );
  });
}

function countAiTurnsSinceHuman(history: Message[]): number {
  let turns = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.sender_type === 'HUMAN_OWNER') break;
    if (msg.direction === 'OUTBOUND' && msg.sender_type === 'AI_AGENT') {
      turns++;
    }
  }
  return turns;
}

function buildRetentionReply(contactName: string, isCommercial: boolean): string {
  const firstName = contactName.split(' ')[0]?.trim() || '¡Hola!';
  const raw = isCommercial
    ? `¡Hola ${firstName}! Qué gusto saludarte. Ya mismo revisamos lo que nos consultás para pasarte la propuesta exacta por acá en unos minutos.`
    : `¡Hola ${firstName}! Gracias por escribirnos. Contanos un poquito más sobre lo que necesitás así te respondemos de forma puntual.`;
  return sanitizeRoboticPhrases(raw);
}

export async function registerApiV1Routes(
  app: FastifyInstance,
  deps: RouteDependencies
): Promise<void> {
  const { dataStore, queueDispatcher, messagingProvider, enforceWhitelist } =
    deps;
  const authenticate = createAuthMiddleware(dataStore);
  const dripCalculator = new SmartDripCalculator();

  // ==========================================================================
  // AUTENTICACIÓN (Dashboard Web — Usuario Maestro Único & Timing-Safe)
  // ==========================================================================

  app.post('/api/v1/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Credenciales incompletas' });
    }

    const { username, password } = parsed.data;
    const isUserValid = timingSafeStringCompare(username, env.ADMIN_USER);
    const isPassValid = timingSafeStringCompare(password, env.ADMIN_PASSWORD);

    if (!isUserValid || !isPassValid) {
      return reply.code(401).send({ error: 'Usuario o contraseña inválidos' });
    }

    const token = app.jwt.sign(
      { user: env.ADMIN_USER, role: 'admin' },
      { expiresIn: '24h' }
    );

    const secureFlag = env.COOKIE_SECURE ? '; Secure' : '';
    reply.header(
      'Set-Cookie',
      `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400${secureFlag}`
    );

    return reply.send({ ok: true, user: env.ADMIN_USER, token });
  });

  app.post('/api/v1/auth/logout', async (_request, reply) => {
    const secureFlag = env.COOKIE_SECURE ? '; Secure' : '';
    reply.header(
      'Set-Cookie',
      `${AUTH_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureFlag}`
    );
    return reply.send({ ok: true });
  });

  app.get(
    '/api/v1/auth/me',
    { preHandler: authenticate },
    async (request) => {
      return {
        authenticated: true,
        user: request.user ?? { user: 'api_key', role: 'integration' },
      };
    }
  );

  // ==========================================================================
  // EVENTOS EN TIEMPO REAL (SSE / Server-Sent Events)
  // ==========================================================================

  app.get(
    '/api/v1/events',
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.raw.flushHeaders?.();

      reply.raw.write(`: connected\n\n`);

      const unsubscribe = await queueDispatcher.subscribeRealtimeEvents(
        (event: RealtimeEvent) => {
          try {
            reply.raw.write(
              `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
            );
          } catch {
            // ignore broken pipe
          }
        }
      );

      const heartbeatInterval = setInterval(() => {
        try {
          reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 20000);

      request.raw.on('close', () => {
        clearInterval(heartbeatInterval);
        Promise.resolve(unsubscribe()).catch(() => {});
      });
    }
  );

  // ==========================================================================
  // CARGA DE MULTIMEDIA (Uploads para Scheduler & Chats)
  // ==========================================================================

  app.post(
    '/api/v1/media/upload',
    { preHandler: authenticate },
    async (request, reply) => {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No se envió ningún archivo' });
      }

      const safeOriginalName = path
        .basename(data.filename)
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueName = `${Date.now()}_${randomBytes(4).toString('hex')}_${safeOriginalName}`;
      const savePath = path.join(env.UPLOADS_DIR, uniqueName);

      await pipeline(data.file, fs.createWriteStream(savePath));

      const ext = path.extname(safeOriginalName).toLowerCase();
      let contentType: ContentType = 'DOCUMENT';
      if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
        contentType = 'IMAGE';
      } else if (ext === '.pdf') {
        contentType = 'PDF';
      }

      const publicUrl = `/api/v1/media/${uniqueName}`;

      return reply.code(201).send({
        ok: true,
        url: publicUrl,
        filename: safeOriginalName,
        contentType,
      });
    }
  );

  // ==========================================================================
  // MENSAJES Y PROGRAMACIÓN INTELIGENTE (SMART DRIP)
  // ==========================================================================

  async function resolveContactForSending(target: {
    contactId?: string;
    phone?: string;
    jid?: string;
  }) {
    let contact = target.contactId
      ? await dataStore.getContactById(target.contactId)
      : null;

    if (!contact && (target.jid || target.phone)) {
      const canonicalJid = target.jid?.includes('@')
        ? target.jid
        : formatToJid(target.jid || target.phone || '');
      contact = await dataStore.getContactByJid(canonicalJid);

      if (!contact && !enforceWhitelist) {
        contact = await dataStore.upsertContact({
          jid: canonicalJid,
          phone_number: normalizePhone(canonicalJid.split('@')[0]),
          is_whitelisted: false,
        });
      }
    }

    return contact;
  }

  app.post(
    '/api/v1/messages/send',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = sendMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Payload inválido', details: parsed.error.flatten() });
      }

      const data = parsed.data;

      if (data.idempotency_key) {
        const existing = await dataStore.findJobByIdempotencyKey(
          data.idempotency_key
        );
        if (existing) {
          return reply.code(200).send({
            ok: true,
            duplicated: true,
            job: existing,
          });
        }
      }

      const contact = await resolveContactForSending(data);
      if (!contact) {
        if (enforceWhitelist) {
          return reply.code(403).send({
            error: 'Forbidden',
            message:
              'El destinatario no existe o no está en la whitelist (ENFORCE_WHITELIST=true).',
          });
        }
        return reply.code(404).send({ error: 'Contacto no encontrado' });
      }

      if (enforceWhitelist && !contact.is_whitelisted) {
        return reply.code(403).send({
          error: 'Forbidden',
          message:
            'El destinatario está bloqueado por el cortafuegos whitelist (ENFORCE_WHITELIST=true).',
        });
      }

      const now = new Date();
      const job = await dataStore.createScheduledJob({
        instance_id: env.INSTANCE_NAME,
        idempotency_key: data.idempotency_key ?? null,
        contact_id: contact.id,
        payload: {
          body: data.text || '',
          media_url: data.mediaUrl,
          media_filename: data.mediaFilename,
          content_type: data.contentType,
          urgent: data.urgent,
        },
        scheduled_for: now,
        effective_send_at: now,
        status: 'PENDING',
      });

      const msg = await dataStore.createMessage({
        instance_id: env.INSTANCE_NAME,
        whatsapp_message_id: `pending_${job.id}`,
        contact_id: contact.id,
        direction: 'OUTBOUND',
        sender_type: 'SYSTEM_API',
        content_type: data.contentType,
        body: data.text || data.mediaFilename || '[Adjunto]',
        media_url: data.mediaUrl ?? null,
        media_filename: data.mediaFilename ?? null,
        is_broadcast: false,
        status: 'QUEUED',
      });

      await queueDispatcher.enqueueOutboundJob(job, 0);

      await queueDispatcher.publishRealtimeEvent({
        type: 'message.created',
        contactId: contact.id,
        jid: contact.jid,
        data: msg,
        timestamp: new Date().toISOString(),
      });

      return reply.code(202).send({
        ok: true,
        duplicated: false,
        job,
        messageId: msg.id,
      });
    }
  );

  app.post(
    '/api/v1/messages/schedule',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = scheduleMessageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ error: 'Payload inválido', details: parsed.error.flatten() });
      }

      const data = parsed.data;
      const requestedAt = new Date(data.scheduledFor);
      if (Number.isNaN(requestedAt.getTime())) {
        return reply
          .code(400)
          .send({ error: 'scheduledFor debe ser una fecha ISO 8601 válida' });
      }

      const targetInputs: Array<{
        contactId?: string;
        phone?: string;
        jid?: string;
      }> = [];
      if (data.contactId) targetInputs.push({ contactId: data.contactId });
      for (const id of data.contactIds || []) {
        targetInputs.push({ contactId: id });
      }
      if (data.phone) targetInputs.push({ phone: data.phone });
      for (const p of data.phones || []) {
        targetInputs.push({ phone: p });
      }
      if (data.jid) targetInputs.push({ jid: data.jid });

      if (data.idempotency_key) {
        const probeKey =
          targetInputs.length === 1
            ? data.idempotency_key
            : `${data.idempotency_key}:0`;
        const existing = await dataStore.findJobByIdempotencyKey(probeKey);
        if (existing) {
          return reply.code(200).send({
            ok: true,
            duplicated: true,
            jobs: [existing],
          });
        }
      }

      const resolvedContacts = [];
      for (const t of targetInputs) {
        const contact = await resolveContactForSending(t);
        if (!contact || (enforceWhitelist && !contact.is_whitelisted)) {
          return reply.code(403).send({
            error: 'Forbidden',
            message:
              'Uno o más destinatarios están fuera de la whitelist habilitada.',
          });
        }
        resolvedContacts.push(contact);
      }

      const effectiveDates = dripCalculator.calculateSchedule(
        requestedAt,
        resolvedContacts.length,
        data.urgent
      );

      const createdJobs: ScheduledJob[] = [];
      for (let i = 0; i < resolvedContacts.length; i++) {
        const contact = resolvedContacts[i];
        const effectiveAt = effectiveDates[i];
        const jobKey = data.idempotency_key
          ? resolvedContacts.length === 1
            ? data.idempotency_key
            : `${data.idempotency_key}:${i}`
          : null;

        const job = await dataStore.createScheduledJob({
          instance_id: env.INSTANCE_NAME,
          idempotency_key: jobKey,
          contact_id: contact.id,
          payload: {
            body: data.text || '',
            media_url: data.mediaUrl,
            media_filename: data.mediaFilename,
            content_type: data.contentType,
            urgent: data.urgent,
          },
          scheduled_for: requestedAt,
          effective_send_at: effectiveAt,
          status: 'PENDING',
        });

        await dataStore.createMessage({
          instance_id: env.INSTANCE_NAME,
          whatsapp_message_id: `pending_${job.id}`,
          contact_id: contact.id,
          direction: 'OUTBOUND',
          sender_type: 'SYSTEM_API',
          content_type: data.contentType,
          body: data.text || data.mediaFilename || '[Adjunto]',
          media_url: data.mediaUrl ?? null,
          media_filename: data.mediaFilename ?? null,
          is_broadcast: false,
          status: 'QUEUED',
        });

        const delayMs = Math.max(0, effectiveAt.getTime() - Date.now());
        await queueDispatcher.enqueueOutboundJob(job, delayMs);
        createdJobs.push(job);
      }

      return reply.code(202).send({
        ok: true,
        duplicated: false,
        count: createdJobs.length,
        jobs: createdJobs,
      });
    }
  );

  app.get(
    '/api/v1/messages/scheduled',
    { preHandler: authenticate },
    async (request) => {
      const { status } = request.query as { status?: JobStatus };
      const jobs = await dataStore.listScheduledJobs(status);
      return { jobs };
    }
  );

  app.patch(
    '/api/v1/messages/scheduled/:jobId',
    { preHandler: authenticate },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const parsed = updateScheduledJobSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Payload inválido' });
      }

      const existing = await dataStore.getScheduledJobById(jobId);
      if (!existing) {
        return reply.code(404).send({ error: 'Trabajo programado no encontrado' });
      }

      const patch: Partial<ScheduledJob> = {};
      if (parsed.data.scheduledFor) {
        const nextDate = new Date(parsed.data.scheduledFor);
        if (Number.isNaN(nextDate.getTime())) {
          return reply.code(400).send({ error: 'Fecha inválida' });
        }
        const [effectiveAt] = dripCalculator.calculateSchedule(
          nextDate,
          1,
          existing.payload.urgent
        );
        patch.scheduled_for = nextDate;
        patch.effective_send_at = effectiveAt;
      }

      if (parsed.data.status) {
        patch.status = parsed.data.status;
        if (parsed.data.status === 'CANCELLED') {
          await queueDispatcher.cancelOutboundJob(jobId);
        }
      }

      const updated = await dataStore.updateScheduledJob(jobId, patch);
      if (updated && patch.effective_send_at && updated.status === 'PENDING') {
        await queueDispatcher.cancelOutboundJob(jobId);
        await queueDispatcher.enqueueOutboundJob(
          updated,
          Math.max(0, updated.effective_send_at.getTime() - Date.now())
        );
      }

      return { ok: true, job: updated };
    }
  );

  app.delete(
    '/api/v1/messages/scheduled/:jobId',
    { preHandler: authenticate },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      await queueDispatcher.cancelOutboundJob(jobId);
      const updated = await dataStore.updateScheduledJob(jobId, {
        status: 'CANCELLED',
      });
      if (!updated) {
        return reply.code(404).send({ error: 'Trabajo no encontrado' });
      }
      return { ok: true, job: updated };
    }
  );

  // ==========================================================================
  // LIBRETA DE CONTACTOS, DIFUSIONES Y WHITELIST
  // ==========================================================================

  app.post(
    '/api/v1/contacts/sync',
    { preHandler: authenticate },
    async () => {
      const rawContacts = await messagingProvider.syncContacts();
      const synced = [];
      for (const c of rawContacts) {
        if (!c.jid || !c.phone_number) continue;
        const upserted = await dataStore.upsertContact({
          ...c,
          jid: c.jid,
          phone_number: c.phone_number,
        });
        synced.push(upserted);
      }
      return { ok: true, synced: synced.length, contacts: synced };
    }
  );

  app.get(
    '/api/v1/contacts',
    { preHandler: authenticate },
    async (request) => {
      const query = request.query as {
        isInBroadcast?: string;
        aiMode?: AIMode;
        search?: string;
      };
      const contacts = await dataStore.listContacts({
        isInBroadcast:
          query.isInBroadcast === 'true'
            ? true
            : query.isInBroadcast === 'false'
            ? false
            : undefined,
        aiMode: query.aiMode,
        search: query.search,
      });
      return { contacts };
    }
  );

  app.post(
    '/api/v1/contacts',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = createContactSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Datos de contacto inválidos' });
      }
      const jid = formatToJid(parsed.data.phone);
      const phoneNumber = normalizePhone(jid.split('@')[0]);
      const contact = await dataStore.upsertContact({
        jid,
        phone_number: phoneNumber,
        address_book_name: parsed.data.name ?? null,
        is_whitelisted: parsed.data.is_whitelisted,
      });
      return reply.code(201).send({ ok: true, contact });
    }
  );

  app.patch(
    '/api/v1/contacts/:contactId/whitelist',
    { preHandler: authenticate },
    async (request, reply) => {
      const { contactId } = request.params as { contactId: string };
      const parsed = whitelistSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Payload inválido' });
      }
      const updated = await dataStore.updateContactWhitelist(
        contactId,
        parsed.data.is_whitelisted
      );
      if (!updated) {
        return reply.code(404).send({ error: 'Contacto no encontrado' });
      }
      return { ok: true, contact: updated };
    }
  );

  // ==========================================================================
  // CONVERSACIONES, MODO IA Y TRASPASO MANUAL
  // ==========================================================================

  app.post(
    '/api/v1/conversations/:contactId/mode',
    { preHandler: authenticate },
    async (request, reply) => {
      const { contactId } = request.params as { contactId: string };
      const parsed = conversationModeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Modo IA inválido' });
      }

      const aiConfig = await dataStore.getAIConfig();
      const muteHours =
        parsed.data.muteHours ?? aiConfig.auto_mute_hours_on_human_reply ?? 24;
      const mutedUntil =
        parsed.data.mode === 'AI_RETENTION'
          ? null
          : new Date(Date.now() + muteHours * 3600 * 1000);

      const updated = await dataStore.updateContactMode(
        contactId,
        parsed.data.mode,
        mutedUntil
      );
      if (!updated) {
        return reply.code(404).send({ error: 'Contacto no encontrado' });
      }

      await queueDispatcher.publishRealtimeEvent({
        type: 'contact.mode_updated',
        contactId: updated.id,
        jid: updated.jid,
        data: {
          aiMode: updated.ai_mode,
          aiMutedUntil: updated.ai_muted_until,
        },
        timestamp: new Date().toISOString(),
      });

      return { ok: true, contact: updated };
    }
  );

  app.get(
    '/api/v1/conversations/:contactId/messages',
    { preHandler: authenticate },
    async (request, reply) => {
      const { contactId } = request.params as { contactId: string };
      const contact = await dataStore.getContactById(contactId);
      if (!contact) {
        return reply.code(404).send({ error: 'Contacto no encontrado' });
      }
      const messages = await dataStore.listMessagesByContact(contactId);
      return { contact, messages };
    }
  );

  app.post(
    '/api/v1/conversations/:contactId/messages',
    { preHandler: authenticate },
    async (request, reply) => {
      const { contactId } = request.params as { contactId: string };
      const parsed = manualReplySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Mensaje inválido' });
      }

      const contact = await dataStore.getContactById(contactId);
      if (!contact) {
        return reply.code(404).send({ error: 'Contacto no encontrado' });
      }

      // Cualquier envío manual del dueño desde el Dashboard silencia la IA al instante
      const aiConfig = await dataStore.getAIConfig();
      const mutedUntil = new Date(
        Date.now() + aiConfig.auto_mute_hours_on_human_reply * 3600 * 1000
      );
      await dataStore.updateContactMode(
        contact.id,
        'HUMAN_TAKEOVER',
        mutedUntil
      );

      const sendResult = await messagingProvider.sendMessage(contact.jid, {
        text: parsed.data.text,
        mediaUrl: parsed.data.mediaUrl,
        mediaFilename: parsed.data.mediaFilename,
        contentType: parsed.data.contentType,
      });

      await queueDispatcher.markMessageSentBySystem(sendResult.messageId);

      const message = await dataStore.createMessage({
        instance_id: env.INSTANCE_NAME,
        whatsapp_message_id: sendResult.messageId,
        contact_id: contact.id,
        direction: 'OUTBOUND',
        sender_type: 'HUMAN_OWNER',
        content_type: parsed.data.contentType,
        body: parsed.data.text || parsed.data.mediaFilename || '[Adjunto]',
        media_url: parsed.data.mediaUrl ?? null,
        media_filename: parsed.data.mediaFilename ?? null,
        is_broadcast: false,
        status: sendResult.status,
      });

      await queueDispatcher.publishRealtimeEvent({
        type: 'message.created',
        contactId: contact.id,
        jid: contact.jid,
        data: message,
        timestamp: new Date().toISOString(),
      });

      return reply.code(201).send({ ok: true, message });
    }
  );

  // ==========================================================================
  // COLA GLOBAL, SALUD DEL SISTEMA, CONFIG IA Y API KEYS
  // ==========================================================================

  app.post(
    '/api/v1/queue/toggle',
    { preHandler: authenticate },
    async (request) => {
      const body = (request.body as { paused?: boolean } | undefined) ?? {};
      const nextPaused =
        typeof body.paused === 'boolean'
          ? body.paused
          : !(await queueDispatcher.isQueuePaused());
      const paused = await queueDispatcher.setQueuePaused(nextPaused);
      return { ok: true, paused };
    }
  );

  app.get(
    '/api/v1/system/health',
    { preHandler: authenticate },
    async () => {
      const [whatsapp, queuePaused, metrics] = await Promise.all([
        messagingProvider.getConnectionStatus(),
        queueDispatcher.isQueuePaused(),
        dataStore.getDailyMetrics(),
      ]);

      return {
        ok: true,
        instanceName: env.INSTANCE_NAME,
        messagingProvider: env.MESSAGING_PROVIDER,
        whatsapp,
        queuePaused,
        metrics,
        enforceWhitelist,
      };
    }
  );

  app.get(
    '/api/v1/ai/config',
    { preHandler: authenticate },
    async () => {
      const config = await dataStore.getAIConfig();
      return { config };
    }
  );

  app.put(
    '/api/v1/ai/config',
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = aiConfigPatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Configuración IA inválida' });
      }
      const config = await dataStore.updateAIConfig(parsed.data);
      return { ok: true, config };
    }
  );

  app.get(
    '/api/v1/keys',
    { preHandler: authenticate },
    async () => {
      const keys = await dataStore.listApiKeys();
      return { keys };
    }
  );

  app.post(
    '/api/v1/keys',
    { preHandler: authenticate },
    async (request, reply) => {
      const { label } = (request.body as { label?: string } | undefined) ?? {};
      if (!label?.trim()) {
        return reply.code(400).send({ error: 'Falta label de la llave' });
      }
      const rawKey = `sk_live_${randomBytes(24).toString('hex')}`;
      const record = await dataStore.createApiKey(
        label.trim(),
        hashApiKey(rawKey)
      );
      return reply.code(201).send({ ok: true, apiKey: rawKey, record });
    }
  );

  // ==========================================================================
  // WEBHOOK INTERNO DE EVOLUTION API v2 (DETECCIÓN DE CELULAR FÍSICO & ACKS)
  // ==========================================================================

  app.post('/api/v1/webhooks/evolution', async (request, reply) => {
    // Verificación de secreto webhook opcional
    if (env.EVOLUTION_WEBHOOK_SECRET) {
      const reqSecret =
        request.headers['apikey'] ||
        request.headers['x-api-key'] ||
        (request.query as Record<string, string>)?.secret;
      if (
        !reqSecret ||
        !timingSafeStringCompare(String(reqSecret), env.EVOLUTION_WEBHOOK_SECRET)
      ) {
        return reply.code(401).send({ error: 'Secreto de webhook inválido' });
      }
    }

    const body = (request.body as Record<string, unknown>) || {};
    const event = String(body.event || '').toLowerCase();

    if (event === 'messages.upsert') {
      const rawData = body.data;
      const items: Array<Record<string, unknown>> = Array.isArray(rawData)
        ? rawData
        : Array.isArray((rawData as { messages?: unknown[] })?.messages)
        ? ((rawData as { messages: Array<Record<string, unknown>> }).messages)
        : rawData && typeof rawData === 'object'
        ? [rawData as Record<string, unknown>]
        : [];

      const aiConfig = await dataStore.getAIConfig();

      for (const item of items) {
        const key = (item.key as Record<string, unknown>) || {};
        const rawRemoteJid = String(key.remoteJid || '');
        const remoteJidAlt = String(key.remoteJidAlt || '');
        const participant = String(key.participant || '');
        const fromMe = Boolean(key.fromMe);
        const waMsgId = String(key.id || `evo_${Date.now()}`);

        if (!rawRemoteJid || rawRemoteJid.endsWith('@g.us')) continue;

        // Resolución de @lid, @broadcast y multi-device (G-05)
        const resolution = resolveEvolutionRemoteTarget({
          remoteJid: rawRemoteJid,
          remoteJidAlt,
          participant,
        });
        if (!resolution) continue;

        const targetJid = resolution.targetJid;
        const phone = normalizePhone(targetJid.split('@')[0]);
        if (!phone) continue;

        const isBroadcast = resolution.isBroadcast;
        const extracted = extractEvolutionText(
          item.message as Record<string, unknown> | undefined
        );

        // Buscar contacto por JID o por LID
        let contact = await dataStore.getContactByJid(targetJid);
        if (!contact && resolution.lid) {
          contact = await dataStore.findContactByLid(resolution.lid);
        }

        const upsertData: Partial<typeof contact> & {
          jid: string;
          phone_number: string;
        } = {
          instance_id: String(body.instance || env.INSTANCE_NAME),
          jid: targetJid,
          phone_number: phone,
          push_name:
            !fromMe && typeof item.pushName === 'string'
              ? item.pushName
              : undefined,
          is_in_broadcast: isBroadcast,
          broadcast_lists: isBroadcast ? [rawRemoteJid] : undefined,
          metadata: {
            remoteJidAlt: remoteJidAlt || undefined,
            lid: resolution.lid || (targetJid.endsWith('@lid') ? targetJid : undefined),
          },
          last_interaction_at: new Date(),
        };

        contact = await dataStore.upsertContact(upsertData);

        if (fromMe) {
          const sentBySystem =
            await queueDispatcher.wasMessageSentBySystem(waMsgId);
          const hasInflight =
            await queueDispatcher.hasOutboundInflight(targetJid);

          if (!sentBySystem && !hasInflight) {
            // Salvaguarda de Celular Físico (PRD § 3): el dueño respondió desde su teléfono
            const mutedUntil = new Date(
              Date.now() +
                aiConfig.auto_mute_hours_on_human_reply * 3600 * 1000
            );
            await dataStore.updateContactMode(
              contact.id,
              'HUMAN_TAKEOVER',
              mutedUntil
            );
            await dataStore.createMessage({
              instance_id: contact.instance_id,
              whatsapp_message_id: waMsgId,
              contact_id: contact.id,
              direction: 'OUTBOUND',
              sender_type: 'HUMAN_OWNER',
              content_type: isBroadcast
                ? 'BROADCAST_CAPTURE'
                : extracted.contentType,
              body: extracted.text || '[Mensaje desde celular físico]',
              media_url: extracted.mediaUrl,
              media_filename: extracted.mediaFilename,
              is_broadcast: isBroadcast,
              status: 'SENT',
            });

            await queueDispatcher.publishRealtimeEvent({
              type: 'contact.mode_updated',
              contactId: contact.id,
              jid: contact.jid,
              data: { aiMode: 'HUMAN_TAKEOVER', mutedUntil },
              timestamp: new Date().toISOString(),
            });
          } else {
            await dataStore.updateMessageStatus(waMsgId, 'SENT');
          }
        } else {
          const inboundMsg = await dataStore.createMessage({
            instance_id: contact.instance_id,
            whatsapp_message_id: waMsgId,
            contact_id: contact.id,
            direction: 'INBOUND',
            sender_type: 'CONTACT',
            content_type: isBroadcast
              ? 'BROADCAST_CAPTURE'
              : extracted.contentType,
            body: extracted.text || '[Mensaje multimedia]',
            media_url: extracted.mediaUrl,
            media_filename: extracted.mediaFilename,
            is_broadcast: isBroadcast,
            status: 'DELIVERED',
          });

          await queueDispatcher.publishRealtimeEvent({
            type: 'message.received',
            contactId: contact.id,
            jid: contact.jid,
            data: inboundMsg,
            timestamp: new Date().toISOString(),
          });

          // Encolar al worker en cola inbound_ai_events
          await queueDispatcher.enqueueInboundAI({
            jid: targetJid,
            contactId: contact.id,
            incomingText: extracted.text,
            messageId: waMsgId,
            timestamp: new Date().toISOString(),
          });

          // Evaluación automática inmediata del Motor de Retención IA (PRD § 3)
          if (!isBroadcast && aiConfig.is_global_enabled) {
            const now = new Date();
            let activeContact = contact;

            if (
              activeContact.ai_mode === 'HUMAN_TAKEOVER' &&
              activeContact.ai_muted_until &&
              new Date(activeContact.ai_muted_until).getTime() <= now.getTime()
            ) {
              activeContact =
                (await dataStore.updateContactMode(
                  activeContact.id,
                  'AI_RETENTION',
                  null
                )) ?? activeContact;
            }

            if (
              activeContact.ai_mode === 'AI_RETENTION' &&
              (!enforceWhitelist || activeContact.is_whitelisted)
            ) {
              if (isOptOutRequest(extracted.text)) {
                await dataStore.updateContactMode(
                  activeContact.id,
                  'MUTED',
                  null
                );
                continue;
              }

              const history = await dataStore.listMessagesByContact(
                activeContact.id,
                30
              );
              const priorAiTurns = countAiTurnsSinceHuman(history);
              const keywordMatched = matchesCommercialHandoff(
                extracted.text,
                aiConfig.handoff_keywords || []
              );
              const maxTurnsReached =
                priorAiTurns + 1 >= Math.max(1, aiConfig.max_auto_turns);

              let escalationReason: EscalationReason | null = null;
              if (keywordMatched) {
                escalationReason = 'KEYWORD_MATCH';
              } else if (maxTurnsReached) {
                escalationReason = 'MAX_TURNS_REACHED';
              }

              const contactName =
                activeContact.address_book_name ||
                activeContact.push_name ||
                activeContact.phone_number ||
                'Cliente';

              const replyText = buildRetentionReply(
                contactName,
                keywordMatched
              );

              const aiJob = await dataStore.createScheduledJob({
                instance_id: activeContact.instance_id || env.INSTANCE_NAME,
                idempotency_key: null,
                contact_id: activeContact.id,
                payload: {
                  body: replyText,
                  content_type: 'TEXT',
                  urgent: true,
                },
                scheduled_for: now,
                effective_send_at: now,
                status: 'PENDING',
              });

              await dataStore.createMessage({
                instance_id: activeContact.instance_id || env.INSTANCE_NAME,
                whatsapp_message_id: `pending_${aiJob.id}`,
                contact_id: activeContact.id,
                direction: 'OUTBOUND',
                sender_type: 'AI_AGENT',
                content_type: 'TEXT',
                body: replyText,
                media_url: null,
                media_filename: null,
                is_broadcast: false,
                status: 'QUEUED',
              });

              await queueDispatcher.enqueueOutboundJob(aiJob, 0);

              if (escalationReason) {
                const muteHours =
                  aiConfig.auto_mute_hours_on_human_reply ||
                  env.AI_AUTO_MUTE_HOURS_ON_HUMAN_REPLY ||
                  24;
                const mutedUntil = new Date(
                  now.getTime() + muteHours * 3600 * 1000
                );
                await dataStore.updateContactMode(
                  activeContact.id,
                  'HUMAN_TAKEOVER',
                  mutedUntil
                );

                const cleanInbound = extracted.text
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, 140);
                const alertPayload: OwnerAlertPayload = {
                  contactId: activeContact.id,
                  contactName,
                  jid: activeContact.jid,
                  phone: activeContact.phone_number,
                  reason: escalationReason,
                  summaryTwoLines: [
                    `Contacto ${contactName} requiere seguimiento humano (${escalationReason}).`,
                    `Último mensaje: "${cleanInbound || '[Adjunto]'}"`,
                  ].join('\n'),
                  chatUrl: `/conversations/${activeContact.id}`,
                  timestamp: now.toISOString(),
                };

                await dataStore.upsertContact({
                  jid: activeContact.jid,
                  phone_number: activeContact.phone_number,
                  metadata: {
                    last_ai_alert: alertPayload,
                  },
                });
              }
            }
          }
        }
      }
    } else if (event === 'messages.update') {
      const rawData = body.data;
      const updates: Array<Record<string, unknown>> = Array.isArray(rawData)
        ? rawData
        : rawData && typeof rawData === 'object'
        ? [rawData as Record<string, unknown>]
        : [];

      for (const upd of updates) {
        const key = (upd.key as Record<string, unknown>) || {};
        const waMsgId = String(key.id || upd.keyId || '');
        const updateObj = (upd.update as Record<string, unknown>) || upd;
        const mappedStatus = mapEvolutionStatus(
          updateObj.status ?? upd.status
        );
        if (waMsgId && mappedStatus) {
          await dataStore.updateMessageStatus(waMsgId, mappedStatus);
          await queueDispatcher.publishRealtimeEvent({
            type: 'message.status',
            data: { whatsappMessageId: waMsgId, status: mappedStatus },
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    return reply.code(200).send({ received: true });
  });

  // ==========================================================================
  // META CLOUD API WEBHOOK (WHATSAPP COEXISTENCE 2026-2027)
  // ==========================================================================

  app.get('/api/v1/webhooks/meta-cloud', async (request, reply) => {
    const query = request.query as Record<string, string>;
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === env.META_VERIFY_TOKEN) {
      return reply.code(200).send(challenge);
    }
    return reply.code(403).send({ error: 'Forbidden' });
  });

  app.post('/api/v1/webhooks/meta-cloud', async (request, reply) => {
    const rawBody = JSON.stringify(request.body);
    const signature = request.headers['x-hub-signature-256'] as
      | string
      | undefined;

    if (env.META_APP_SECRET && signature) {
      const isValid = verifyMetaWebhookSignature(
        rawBody,
        signature,
        env.META_APP_SECRET
      );
      if (!isValid) {
        return reply
          .code(401)
          .send({ error: 'Firma de webhook de Meta inválida' });
      }
    }

    const body = (request.body as Record<string, unknown>) || {};
    const entries = Array.isArray(body.entry) ? body.entry : [];

    for (const entry of entries as Array<Record<string, unknown>>) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes as Array<Record<string, unknown>>) {
        const val = (change.value as Record<string, unknown>) || {};
        const messages = Array.isArray(val.messages) ? val.messages : [];
        const statuses = Array.isArray(val.statuses) ? val.statuses : [];

        // Mensajes entrantes
        for (const m of messages as Array<Record<string, unknown>>) {
          const from = String(m.from || '');
          const waId = String(m.id || '');
          const jid = formatToJid(from);
          const phone = normalizePhone(from);

          let text = '';
          let contentType: ContentType = 'TEXT';
          let mediaUrl: string | null = null;

          if (m.type === 'text') {
            text = String((m.text as { body?: string })?.body || '');
          } else if (m.type === 'image') {
            contentType = 'IMAGE';
            text = String((m.image as { caption?: string })?.caption || '[Imagen]');
          } else if (m.type === 'document') {
            contentType = 'DOCUMENT';
            text = String(
              (m.document as { filename?: string })?.filename || '[Documento]'
            );
          }

          const contact = await dataStore.upsertContact({
            instance_id: env.INSTANCE_NAME,
            jid,
            phone_number: phone,
            last_interaction_at: new Date(),
          });

          const created = await dataStore.createMessage({
            instance_id: env.INSTANCE_NAME,
            whatsapp_message_id: waId,
            contact_id: contact.id,
            direction: 'INBOUND',
            sender_type: 'CONTACT',
            content_type: contentType,
            body: text,
            media_url: mediaUrl,
            media_filename: null,
            is_broadcast: false,
            status: 'DELIVERED',
          });

          await queueDispatcher.publishRealtimeEvent({
            type: 'message.received',
            contactId: contact.id,
            jid: contact.jid,
            data: created,
            timestamp: new Date().toISOString(),
          });

          await queueDispatcher.enqueueInboundAI({
            jid,
            contactId: contact.id,
            incomingText: text,
            messageId: waId,
            timestamp: new Date().toISOString(),
          });
        }

        // Estados de entrega de Meta
        for (const s of statuses as Array<Record<string, unknown>>) {
          const waId = String(s.id || '');
          const statusStr = String(s.status || '').toLowerCase();
          let mapped: MessageStatus | null = null;
          if (statusStr === 'sent') mapped = 'SENT';
          if (statusStr === 'delivered') mapped = 'DELIVERED';
          if (statusStr === 'read') mapped = 'READ';
          if (statusStr === 'failed') mapped = 'FAILED';

          if (waId && mapped) {
            await dataStore.updateMessageStatus(waId, mapped);
            await queueDispatcher.publishRealtimeEvent({
              type: 'message.status',
              data: { whatsappMessageId: waId, status: mapped },
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }

    return reply.code(200).send({ received: true });
  });
}
