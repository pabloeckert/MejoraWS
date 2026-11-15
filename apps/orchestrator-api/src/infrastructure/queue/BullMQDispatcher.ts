import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type { ScheduledJob } from '@mejoraws/shared';
import type { IQueueDispatcher } from '../../domain/ports.js';

export const OUTBOUND_QUEUE_NAME = 'outbound_messages';

export class BullMQDispatcher implements IQueueDispatcher {
  private readonly redis: Redis;
  private readonly queue: Queue;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    this.queue = new Queue(OUTBOUND_QUEUE_NAME, {
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
    await this.queue.close();
    await this.redis.quit();
  }

  async enqueueOutboundJob(job: ScheduledJob, delayMs: number): Promise<void> {
    await this.queue.add(
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
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      await existing.remove();
    }
  }

  async setQueuePaused(paused: boolean): Promise<boolean> {
    if (paused) {
      await this.queue.pause();
      await this.redis.set('mejoraws:queue:paused', '1');
    } else {
      await this.queue.resume();
      await this.redis.set('mejoraws:queue:paused', '0');
    }
    return paused;
  }

  async isQueuePaused(): Promise<boolean> {
    const flag = await this.redis.get('mejoraws:queue:paused');
    if (flag === '1') return true;
    return this.queue.isPaused();
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
}

export class InMemoryQueueDispatcher implements IQueueDispatcher {
  public readonly enqueuedJobs: Array<{ job: ScheduledJob; delayMs: number }> =
    [];
  private paused = false;
  private sentCache = new Map<string, number>();

  async enqueueOutboundJob(job: ScheduledJob, delayMs: number): Promise<void> {
    this.enqueuedJobs.push({ job, delayMs: Math.max(0, Math.round(delayMs)) });
  }

  async cancelOutboundJob(jobId: string): Promise<void> {
    const idx = this.enqueuedJobs.findIndex((item) => item.job.id === jobId);
    if (idx !== -1) {
      this.enqueuedJobs.splice(idx, 1);
    }
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
}
