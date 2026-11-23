import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { ThrottlerStorageService } from '@nestjs/throttler/dist/throttler.service';
import { CacheService } from './cache.service';

export class RedisThrottlerStorage implements ThrottlerStorage {
  storage: Record<string, any> = {};
  private readonly memoryFallback = new ThrottlerStorageService();

  constructor(private readonly cache: CacheService) {}

  async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
    const redisKey = `throttle:${key}`;
    const result = await this.cache.increment(redisKey, ttl);
    if (result) return result;
    return this.memoryFallback.increment(key, ttl);
  }

  onApplicationShutdown(): void {
    this.memoryFallback.onApplicationShutdown();
  }
}
