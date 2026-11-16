import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type { RealtimeEvent, ScheduledJob } from '@mejoraws/shared';
import type { IQueueDispatcher, InboundAIPayload } from '../../domain/ports.js';

export const OUTBOUND_QUEUE_NAME = 'outbound_messages';
export const INBOUND_AI_QUEUE_NAME = 'inbound_ai_events';
export const REALTIME_CHANNEL = 'mejoraws:realtime:events';

export class BullMQDispatcher implements IQueueDispatcher {
  private readonly redis: Redis;
  private subRedis: Redis | null = null;
  private readonly outboundQueue: Queue;
  private readonly inboundAiQueue: Queue;
  private readonly redisUrl: string;

  constructor(redisUrl: string) {
    this.redisUrl = redisUrl;
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    this.outboundQueue = new Queue(OUTBOUND_QUEUE_NAME, {
      connection: this.redis,
    });
    this.inboundAiQueue = new Queue(INBOUND_AI_QUEUE_NAME, {
      connection: this.redis,
    });
  }

  async connect(): Promise<void> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }
    await this.redis.ping();
  }

  async close(): Promise<void> {
    if (this.subRedis) {
      await this.subRedis.quit();
      this.subRedis = null;
    }
    await this.outboundQueue.close();
    await this.inboundAiQueue.close();
    await this.redis.quit();
  }

  async enqueueOutboundJob(job: ScheduledJob, delayMs: number): Promise<void> {
    await this.outboundQueue.add(
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
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 500,
        removeOnFail: 500,
      }
    );
  }

  async cancelOutboundJob(jobId: string): Promise<void> {
    const existing = await this.outboundQueue.getJob(jobId);
    if (existing) {
      await existing.remove();
    }
  }

  async enqueueInboundAI(payload: InboundAIPayload): Promise<void> {
    await this.inboundAiQueue.add('process_retention', payload, {
      jobId: `ai_inbound_${payload.messageId}_${Date.now()}`,
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 2000,
      },
      removeOnComplete: 300,
      removeOnFail: 300,
    });
  }

  async setQueuePaused(paused: boolean): Promise<boolean> {
    if (paused) {
      await this.outboundQueue.pause();
      await this.redis.set('mejoraws:queue:paused', '1');
    } else {
      await this.outboundQueue.resume();
      await this.redis.set('mejoraws:queue:paused', '0');
    }
    return paused;
  }

  async isQueuePaused(): Promise<boolean> {
    const flag = await this.redis.get('mejoraws:queue:paused');
    if (flag === '1') return true;
    return this.outboundQueue.isPaused();
  }

  async markMessageSentBySystem(
    whatsappMessageId: string,
    ttlSeconds = 86400
  ): Promise<void> {
    await this.redis.set(
      `sent_cache:${whatsappMessageId}`,
      '1',
      'EX',
      ttlSeconds
    );
  }

  async wasMessageSentBySystem(whatsappMessageId: string): Promise<boolean> {
    const val = await this.redis.get(`sent_cache:${whatsappMessageId}`);
    return val === '1';
  }

  async markOutboundInflight(jid: string, ttlSeconds = 30): Promise<void> {
    await this.redis.set(`outbound_inflight:${jid}`, '1', 'EX', ttlSeconds);
  }

  async clearOutboundInflight(jid: string): Promise<void> {
    await this.redis.del(`outbound_inflight:${jid}`);
  }

  async hasOutboundInflight(jid: string): Promise<boolean> {
    const exists = await this.redis.exists(`outbound_inflight:${jid}`);
    return exists === 1;
  }

  async publishRealtimeEvent(event: RealtimeEvent): Promise<void> {
    await this.redis.publish(REALTIME_CHANNEL, JSON.stringify(event));
  }

  async subscribeRealtimeEvents(
    listener: (event: RealtimeEvent) => void
  ): Promise<() => void> {
    if (!this.subRedis) {
      this.subRedis = new Redis(this.redisUrl, { lazyConnect: true });
      await this.subRedis.connect();
    }

    const handler = (channel: string, message: string) => {
      if (channel === REALTIME_CHANNEL) {
        try {
          const parsed = JSON.parse(message) as RealtimeEvent;
          listener(parsed);
        } catch {
          // ignore malformed JSON
        }
      }
    };

    this.subRedis.on('message', handler);
    await this.subRedis.subscribe(REALTIME_CHANNEL);

    return async () => {
      if (this.subRedis) {
        this.subRedis.off('message', handler);
      }
    };
  }
}

export class InMemoryQueueDispatcher implements IQueueDispatcher {
  public readonly enqueuedJobs: Array<{ job: ScheduledJob; delayMs: number }> =
    [];
  public readonly enqueuedAIPayloads: InboundAIPayload[] = [];
  private paused = false;
  private sentCache = new Map<string, number>();
  private inflightLocks = new Map<string, number>();
  private subscribers = new Set<(event: RealtimeEvent) => void>();

  async enqueueOutboundJob(job: ScheduledJob, delayMs: number): Promise<void> {
    this.enqueuedJobs.push({ job, delayMs: Math.max(0, Math.round(delayMs)) });
  }

  async cancelOutboundJob(jobId: string): Promise<void> {
    const idx = this.enqueuedJobs.findIndex((item) => item.job.id === jobId);
    if (idx !== -1) {
      this.enqueuedJobs.splice(idx, 1);
    }
  }

  async enqueueInboundAI(payload: InboundAIPayload): Promise<void> {
    this.enqueuedAIPayloads.push(payload);
  }

  async setQueuePaused(paused: boolean): Promise<boolean> {
    this.paused = paused;
    return this.paused;
  }

  async isQueuePaused(): Promise<boolean> {
    return this.paused;
  }

  async markMessageSentBySystem(
    whatsappMessageId: string,
    ttlSeconds = 86400
  ): Promise<void> {
    this.sentCache.set(whatsappMessageId, Date.now() + ttlSeconds * 1000);
  }

  async wasMessageSentBySystem(whatsappMessageId: string): Promise<boolean> {
    const expiresAt = this.sentCache.get(whatsappMessageId);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.sentCache.delete(whatsappMessageId);
      return false;
    }
    return true;
  }

  async markOutboundInflight(jid: string, ttlSeconds = 30): Promise<void> {
    this.inflightLocks.set(jid, Date.now() + ttlSeconds * 1000);
  }

  async clearOutboundInflight(jid: string): Promise<void> {
    this.inflightLocks.delete(jid);
  }

  async hasOutboundInflight(jid: string): Promise<boolean> {
    const expiresAt = this.inflightLocks.get(jid);
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
      this.inflightLocks.delete(jid);
      return false;
    }
    return true;
  }

  async publishRealtimeEvent(event: RealtimeEvent): Promise<void> {
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch {
        // ignore subscriber errors
      }
    }
  }

  async subscribeRealtimeEvents(
    listener: (event: RealtimeEvent) => void
  ): Promise<() => void> {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }
}
