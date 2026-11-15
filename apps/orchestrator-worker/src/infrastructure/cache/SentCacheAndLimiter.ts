import { Redis } from 'ioredis';
import type { ISentCacheAndLimiter } from '../../domain/ports.js';

function getHourBucket(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  return `${y}-${m}-${d}-${h}`;
}

export class RedisSentCacheAndLimiter implements ISentCacheAndLimiter {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }

  async connect(): Promise<void> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }
    await this.redis.ping();
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }

  getConnection(): Redis {
    return this.redis;
  }

  async isQueuePaused(): Promise<boolean> {
    const val = await this.redis.get('mejoraws:queue:paused');
    return val === '1';
  }

  async setQueuePaused(paused: boolean): Promise<boolean> {
    await this.redis.set('mejoraws:queue:paused', paused ? '1' : '0');
    return paused;
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

  async acquireIdempotencyLock(
    idempotencyKey: string,
    ttlSeconds = 86400
  ): Promise<boolean> {
    const res = await this.redis.set(
      `mejoraws:idempotency:${idempotencyKey}`,
      '1',
      'EX',
      ttlSeconds,
      'NX'
    );
    return res === 'OK';
  }

  async incrementAndCheckHourlyLimit(
    maxMessagesPerHour: number,
    now = new Date()
  ): Promise<{ allowed: boolean; currentCount: number }> {
    const key = `mejoraws:ratelimit:hour:${getHourBucket(now)}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 3700);
    }
    if (count > maxMessagesPerHour) {
      await this.redis.decr(key);
      return { allowed: false, currentCount: count - 1 };
    }
    return { allowed: true, currentCount: count };
  }
}

export class InMemorySentCacheAndLimiter implements ISentCacheAndLimiter {
  private paused = false;
  private readonly sentCache = new Map<string, number>();
  private readonly idempotencyLocks = new Map<string, number>();
  private readonly hourlyCounters = new Map<string, number>();

  async isQueuePaused(): Promise<boolean> {
    return this.paused;
  }

  async setQueuePaused(paused: boolean): Promise<boolean> {
    this.paused = paused;
    return this.paused;
  }

  async markMessageSentBySystem(
    whatsappMessageId: string,
    ttlSeconds = 86400
  ): Promise<void> {
    this.sentCache.set(whatsappMessageId, Date.now() + ttlSeconds * 1000);
  }

  async wasMessageSentBySystem(whatsappMessageId: string): Promise<boolean> {
    const exp = this.sentCache.get(whatsappMessageId);
    if (!exp) return false;
    if (Date.now() > exp) {
      this.sentCache.delete(whatsappMessageId);
      return false;
    }
    return true;
  }

  async acquireIdempotencyLock(
    idempotencyKey: string,
    ttlSeconds = 86400
  ): Promise<boolean> {
    const existingExp = this.idempotencyLocks.get(idempotencyKey);
    if (existingExp && Date.now() <= existingExp) {
      return false;
    }
    this.idempotencyLocks.set(
      idempotencyKey,
      Date.now() + ttlSeconds * 1000
    );
    return true;
  }

  async incrementAndCheckHourlyLimit(
    maxMessagesPerHour: number,
    now = new Date()
  ): Promise<{ allowed: boolean; currentCount: number }> {
    const bucket = getHourBucket(now);
    const current = this.hourlyCounters.get(bucket) ?? 0;
    if (current >= maxMessagesPerHour) {
      return { allowed: false, currentCount: current };
    }
    const next = current + 1;
    this.hourlyCounters.set(bucket, next);
    return { allowed: true, currentCount: next };
  }
}
