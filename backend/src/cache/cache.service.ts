import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnApplicationShutdown {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis | null;
  private readonly ttlSeconds: number;
  private warningLogged = false;
  private available = false;

  constructor(config: ConfigService) {
    const host = config.get<string>('redis.host')?.trim();
    this.ttlSeconds = config.get<number>('cache.ttlSeconds') ?? 300;

    if (!host) {
      this.client = null;
      this.logUnavailable();
      return;
    }

    this.client = new Redis({
      host,
      port: config.get<number>('redis.port') ?? 6379,
      password: config.get<string>('redis.password') || undefined,
      lazyConnect: true,
      connectTimeout: 500,
      commandTimeout: 300,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times <= 1 ? 100 : null),
    });

    this.client.on('ready', () => {
      this.available = true;
    });
    this.client.on('end', () => {
      this.available = false;
    });
    this.client.on('error', () => {
      this.available = false;
      this.logUnavailable();
    });

    void this.client.connect().then(
      () => {
        this.available = true;
      },
      () => {
        this.available = false;
        this.logUnavailable();
      },
    );
  }

  get isAvailable(): boolean {
    return this.available && this.client?.status === 'ready';
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable || !this.client) return null;
    try {
      const value = await this.withTimeout(this.client.get(key));
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = this.ttlSeconds): Promise<void> {
    if (!this.isAvailable || !this.client) return;
    try {
      await this.withTimeout(this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds));
    } catch {
      this.available = false;
      this.logUnavailable();
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isAvailable || !this.client) return;
    try {
      await this.withTimeout(this.client.del(key));
    } catch {
      this.available = false;
      this.logUnavailable();
    }
  }

  async delByPrefix(prefix: string): Promise<void> {
    if (!this.isAvailable || !this.client) return;
    try {
      await new Promise<void>((resolve, reject) => {
        const stream = this.client!.scanStream({ match: `${prefix}*`, count: 100 });
        let pending = Promise.resolve();

        stream.on('data', (keys: string[]) => {
          stream.pause();
          pending = pending.then(async () => {
            if (keys.length) await this.withTimeout(this.client!.del(...keys));
          }).catch(reject);
          pending.finally(() => stream.resume());
        });
        stream.on('end', () => {
          pending.then(() => resolve()).catch(reject);
        });
        stream.on('error', reject);
      });
    } catch {
      this.available = false;
      this.logUnavailable();
    }
  }

  async invalidateResource(resource: 'site' | 'equipment' | 'equipment-soft' | 'contract' | 'type-support' | 'solution' | 'user'): Promise<void> {
    const dependencies: Record<string, string[]> = {
      site: ['sites'],
      equipment: ['equipment', 'sites'],
      'equipment-soft': ['equipment-softs', 'sites'],
      contract: ['contracts'],
      'type-support': ['type-supports', 'equipment', 'equipment-softs', 'contracts'],
      solution: ['solutions'],
      user: ['contracts', 'solutions'],
    };

    for (const prefix of dependencies[resource] ?? []) {
      await this.delByPrefix(prefix);
    }
  }

  async increment(key: string, ttlSeconds: number): Promise<{ totalHits: number; timeToExpire: number } | null> {
    if (!this.isAvailable || !this.client) return null;
    try {
      const totalHits = await this.withTimeout(this.client.incr(key));
      if (totalHits === 1) await this.withTimeout(this.client.expire(key, ttlSeconds));
      const ttl = await this.withTimeout(this.client.pttl(key));
      return {
        totalHits,
        timeToExpire: ttl > 0 ? Math.max(1, Math.ceil(ttl / 1000)) : ttlSeconds,
      };
    } catch {
      this.available = false;
      this.logUnavailable();
      return null;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client) await this.client.quit().catch(() => undefined);
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout;
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Redis timeout')), 300);
      }),
    ]).finally(() => clearTimeout(timer));
  }

  private logUnavailable(): void {
    if (this.warningLogged) return;
    this.warningLogged = true;
    this.logger.warn('Redis unavailable or not configured; caching and shared rate-limit counters are disabled.');
  }
}
