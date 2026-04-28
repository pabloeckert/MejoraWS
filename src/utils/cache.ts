// src/utils/cache.ts
// Redis cache layer con fallback a in-memory
// Si Redis no está disponible, usa Map en memoria

import { childLogger } from './logger'

const log = childLogger('cache')

interface CacheEntry {
  value: string
  expiresAt: number
}

interface CacheAdapter {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
  has(key: string): Promise<boolean>
  clear(): Promise<void>
  close(): Promise<void>
}

/**
 * In-memory cache (fallback, zero dependencies)
 */
class MemoryCache implements CacheAdapter {
  private store: Map<string, CacheEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Cleanup expired entries every 60s
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.store) {
        if (entry.expiresAt <= now) {
          this.store.delete(key)
        }
      }
    }, 60000)

    // Don't block process exit
    this.cleanupInterval.unref()

    log.info('Memory cache initialized')
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  async set(key: string, value: string, ttlSeconds: number = 300): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async has(key: string): Promise<boolean> {
    const val = await this.get(key)
    return val !== null
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  async close(): Promise<void> {
    clearInterval(this.cleanupInterval)
    this.store.clear()
  }
}

/**
 * Redis cache (requiere redis, carga dinámica)
 */
class RedisCache implements CacheAdapter {
  private client: any

  constructor(client: any) {
    this.client = client
    log.info('Redis cache initialized')
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key)
    } catch (err: any) {
      log.warn({ err: err.message, key }, 'Redis GET error')
      return null
    }
  }

  async set(key: string, value: string, ttlSeconds: number = 300): Promise<void> {
    try {
      if (ttlSeconds > 0) {
        await this.client.setex(key, ttlSeconds, value)
      } else {
        await this.client.set(key, value)
      }
    } catch (err: any) {
      log.warn({ err: err.message, key }, 'Redis SET error')
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key)
    } catch (err: any) {
      log.warn({ err: err.message, key }, 'Redis DEL error')
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      return (await this.client.exists(key)) === 1
    } catch {
      return false
    }
  }

  async clear(): Promise<void> {
    try {
      await this.client.flushdb()
    } catch (err: any) {
      log.warn({ err: err.message }, 'Redis FLUSH error')
    }
  }

  async close(): Promise<void> {
    try {
      await this.client.quit()
    } catch {}
  }
}

/**
 * Factory: crea cache adapter según configuración
 * Si Redis no está disponible, fallback a memory cache
 */
export async function createCache(redisUrl?: string): Promise<CacheAdapter> {
  if (redisUrl) {
    try {
      // Dynamic import with require fallback (ioredis is optional)
      let Redis: any
      try {
        Redis = (await import(/* webpackIgnore: true */ 'ioredis' as any)).default
      } catch {
        // Fallback to require for environments where dynamic import fails
        Redis = require('ioredis')
      }
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) return null // Stop retrying
          return Math.min(times * 200, 2000)
        },
        lazyConnect: true,
      })

      await client.connect()
      log.info({ url: redisUrl }, 'Redis connected')
      return new RedisCache(client)
    } catch (err: any) {
      log.warn({ err: err.message }, 'Redis not available, using memory cache')
    }
  }

  return new MemoryCache()
}

/**
 * Cache key helpers
 */
export const cacheKeys = {
  contacts: (filters?: string) => `contacts:${filters || 'all'}`,
  contact: (id: string) => `contact:${id}`,
  deals: (filters?: string) => `deals:${filters || 'all'}`,
  pipeline: () => 'pipeline',
  campaigns: () => 'campaigns',
  status: () => 'status',
  analytics: (type: string) => `analytics:${type}`,
  health: () => 'health',
}
