import { ConfigService } from '@nestjs/config';
import { CacheService } from '../src/cache/cache.service';
import { TypeSupportsService } from '../src/type-supports/type-supports.service';

describe('CacheService', () => {
  it('skips caching when REDIS_HOST is empty', async () => {
    const config = new ConfigService({
      redis: { host: '', port: 6379, password: '' },
      cache: { ttlSeconds: 300 },
    });
    const cache = new CacheService(config);

    await expect(cache.get('sites:list')).resolves.toBeNull();
    await expect(cache.set('sites:list', [{ id: 1 }])).resolves.toBeUndefined();
    await expect(cache.del('sites:list')).resolves.toBeUndefined();
    await expect(cache.delByPrefix('sites')).resolves.toBeUndefined();
  });

  it('uses JSON values and exposes an unavailable fallback', async () => {
    const config = new ConfigService({
      redis: { host: '127.0.0.1', port: 1, password: '' },
      cache: { ttlSeconds: 300 },
    });
    const cache = new CacheService(config);

    await expect(cache.get<{ id: number }>('equipment:one:1')).resolves.toBeNull();
    await expect(cache.set('equipment:one:1', { id: 1 })).resolves.toBeUndefined();
    await expect(cache.increment('throttle:test', 60)).resolves.toBeNull();
    await cache.onApplicationShutdown();
  });

  it('maps type-support changes to equipment, equipment-software, and contracts', async () => {
    const cache = {
      delByPrefix: jest.fn().mockResolvedValue(undefined),
      invalidateResource: CacheService.prototype.invalidateResource,
    } as unknown as CacheService;

    await cache.invalidateResource('type-support');

    expect(cache.delByPrefix).toHaveBeenCalledWith('type-supports');
    expect(cache.delByPrefix).toHaveBeenCalledWith('equipment');
    expect(cache.delByPrefix).toHaveBeenCalledWith('equipment-softs');
    expect(cache.delByPrefix).toHaveBeenCalledWith('contracts');
  });

  it('invalidates dependent keys when a type-support is updated', async () => {
    const cache = {
      get: jest.fn(),
      set: jest.fn(),
      invalidateResource: jest.fn(),
    } as unknown as CacheService;
    const entity = { id: 1, supportName: 'Old', supportEmail: 'old@example.com' };
    const repository = {
      findOne: jest.fn().mockResolvedValue(entity),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const storage = { getUrl: jest.fn().mockResolvedValue(null) } as any;
    const service = new TypeSupportsService(repository as any, cache, storage);

    await service.update(1, { supportName: 'New', supportEmail: 'new@example.com' });

    expect(cache.invalidateResource).toHaveBeenCalledWith('type-support');
  });

  it('allows a write to succeed when Redis is unavailable', async () => {
    const config = new ConfigService({
      redis: { host: '', port: 6379, password: '' },
      cache: { ttlSeconds: 300 },
    });
    const cache = new CacheService(config);
    const entity = { id: 1, supportName: 'Support' };
    const repository = {
      create: jest.fn().mockReturnValue(entity),
      save: jest.fn().mockResolvedValue(entity),
    };
    const storage = { upload: jest.fn(), delete: jest.fn(), getUrl: jest.fn().mockResolvedValue(null), logDeleteError: jest.fn() } as any;
    const service = new TypeSupportsService(repository as any, cache, storage);

    await expect(service.create({ supportName: 'Support', supportEmail: 'support@example.com' })).resolves.toMatchObject({
      id: 1,
      supportName: 'Support',
    });
  });
});
