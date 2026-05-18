import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis abstraction for rate limiting, session tracking, and IP throttling.
 * Not used for permanent vote storage (votes remain in PostgreSQL only).
 * When REDIS_URL is not set, isAvailable() is false and methods no-op or return safe defaults.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  async onModuleInit(): Promise<void> {
    const url = process.env.REDIS_URL;
    if (!url?.trim()) {
      this.logger.warn('REDIS_URL not set; Redis disabled. Rate limiting and session tracking will use in-memory fallback where applicable.');
      return;
    }
    try {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => (times <= 3 ? Math.min(times * 200, 2000) : null),
        lazyConnect: true,
      });
      this.client.on('error', (err) => {
        this.logger.warn('Redis error (using fallback)', err?.message ?? err);
      });
      this.client.on('close', () => {
        this.client = null;
      });
      await this.client.connect();
      this.logger.log('Redis connected');
    } catch (err) {
      this.logger.error('Redis connection failed', err);
      this.client = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.logger.log('Redis disconnected');
    }
  }

  isAvailable(): boolean {
    return this.client != null;
  }

  private async run<T>(fn: (client: Redis) => Promise<T>): Promise<T | null> {
    if (!this.client) return null;
    try {
      return await fn(this.client);
    } catch (err) {
      this.logger.warn('Redis operation failed', err);
      return null;
    }
  }

  /** Get string value */
  async get(key: string): Promise<string | null> {
    return this.run((c) => c.get(key));
  }

  /** Set with optional TTL in seconds */
  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    const result = await this.run(async (c) => {
      if (ttlSeconds != null && ttlSeconds > 0) {
        await c.setex(key, ttlSeconds, value);
      } else {
        await c.set(key, value);
      }
      return 'OK';
    });
    return result === 'OK';
  }

  /** Increment key and optionally set TTL on first increment (for rate limiting) */
  async incr(key: string): Promise<number | null> {
    return this.run(async (c) => {
      const n = await c.incr(key);
      return n;
    });
  }

  /** Set TTL in seconds. Returns true if key exists and TTL was set. */
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.run((c) => c.expire(key, seconds));
    return result === 1;
  }

  /** Increment and set TTL only when key is new (for sliding or fixed-window rate limits) */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number | null> {
    return this.run(async (c) => {
      const n = await c.incr(key);
      if (n === 1) await c.expire(key, ttlSeconds);
      return n;
    });
  }

  /** Delete key */
  async del(key: string): Promise<boolean> {
    const result = await this.run((c) => c.del(key));
    return (result ?? 0) > 0;
  }

  // --- Vote rate limiting (per fingerprint) ---
  /** Key: ratelimit:vote:fingerprint:{fingerprint}. Returns current count in window. */
  async getVoteRateLimitCount(fingerprint: string): Promise<number | null> {
    const key = `ratelimit:vote:fingerprint:${fingerprint}`;
    const v = await this.get(key);
    return v == null ? null : parseInt(v, 10);
  }

  /** Increment vote attempt count; TTL = windowSeconds. Returns new count. */
  async incrementVoteRateLimit(fingerprint: string, windowSeconds: number): Promise<number | null> {
    const key = `ratelimit:vote:fingerprint:${fingerprint}`;
    return this.incrWithTtl(key, windowSeconds);
  }

  // --- Session vote tracking (has this session voted in this period?) ---
  /** Key: session:vote:{periodId}:{fingerprint}. Set after successful vote. */
  async setSessionVoted(periodId: string, fingerprint: string, ttlSeconds: number): Promise<boolean> {
    const key = `session:vote:${periodId}:${fingerprint}`;
    return this.set(key, '1', ttlSeconds);
  }

  /** Check if session already voted in period (fast path before DB). */
  async hasSessionVoted(periodId: string, fingerprint: string): Promise<boolean> {
    const key = `session:vote:${periodId}:${fingerprint}`;
    const v = await this.get(key);
    return v === '1';
  }

  // --- IP throttling ---
  /** Key: ratelimit:ip:{ip}. Increment and return count in window. */
  async incrementIpThrottle(ip: string, windowSeconds: number): Promise<number | null> {
    const key = `ratelimit:ip:${ip}`;
    return this.incrWithTtl(key, windowSeconds);
  }
}
