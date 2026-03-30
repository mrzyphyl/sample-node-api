import Redis from 'ioredis';
import { createClient } from 'redis';

class CacheService {
  private redis: Redis;
  private localCache: Map<string, { value: string; expires: number }> = new Map();
  private useLocal = false;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
    });
  }

  private isLocalExpired(key: string): boolean {
    const item = this.localCache.get(key);
    if (!item) return true;
    return Date.now() > item.expires;
  }

  private getLocal(key: string): string | null {
    if (this.isLocalExpired(key)) {
      this.localCache.delete(key);
      return null;
    }
    return this.localCache.get(key)!.value;
  }

  private setLocal(key: string, value: string, ttlSeconds: number): void {
    this.localCache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    });
  }

  async get(key: string): Promise<string | null> {
    const localValue = this.getLocal(key);
    if (localValue) return localValue;

    const redisValue = await this.redis.get(key);
    if (redisValue) {
      const ttl = await this.redis.ttl(key);
      if (ttl > 0) {
        this.setLocal(key, redisValue, ttl);
      }
    }
    return redisValue;
  }

  async set(key: string, value: string, ttlSeconds: number = 300): Promise<void> {
    await this.redis.setex(key, ttlSeconds, value);
    this.setLocal(key, value, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
    this.localCache.delete(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
    for (const key of this.localCache.keys()) {
      if (key.includes(pattern.replace('*', ''))) {
        this.localCache.delete(key);
      }
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttlSeconds: number = 300): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async exists(key: string): Promise<boolean> {
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async incr(key: string): Promise<number> {
    return await this.redis.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.redis.expire(key, ttlSeconds);
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return await this.redis.mget(...keys);
  }

  async mset(keyValues: Record<string, string>, ttlSeconds?: number): Promise<void> {
    const pipeline = this.redis.pipeline();
    for (const [key, value] of Object.entries(keyValues)) {
      pipeline.setex(key, ttlSeconds || 300, value);
    }
    await pipeline.exec();
  }
}

export const cacheService = new CacheService();
