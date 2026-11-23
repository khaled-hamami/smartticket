import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeSupport } from './entities/type-support.entity';
import { CreateTypeSupportDto } from './dto/create-type-support.dto';
import { UpdateTypeSupportDto } from './dto/update-type-support.dto';
import { CacheService } from '../cache/cache.service';
import { StorageService } from '../storage/storage.service';
import { randomUUID } from 'crypto';
import type { Express } from 'express';

export interface TypeSupportWithLogoUrl extends TypeSupport {
  logoUrl: string | null;
}

export function validateLogoFile(file?: Express.Multer.File): { ext: 'png' | 'jpg' | 'webp'; contentType: string } {
  if (!file) throw new BadRequestException('Aucun fichier fourni. Utilisez le champ multipart « file ».');
  if (file.size > 2 * 1024 * 1024) throw new BadRequestException('Le logo ne doit pas dépasser 2 MB.');

  const allowed: Record<string, { ext: 'png' | 'jpg' | 'webp'; contentType: string }> = {
    'image/png': { ext: 'png', contentType: 'image/png' },
    'image/jpeg': { ext: 'jpg', contentType: 'image/jpeg' },
    'image/webp': { ext: 'webp', contentType: 'image/webp' },
  };
  const type = allowed[file.mimetype];
  if (!type) throw new BadRequestException('Format de logo invalide. Formats acceptés : PNG, JPEG ou WebP.');

  const png = file.buffer?.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = file.buffer?.length >= 3 && file.buffer[0] === 255 && file.buffer[1] === 216 && file.buffer[2] === 255;
  const webp = file.buffer?.length >= 12
    && file.buffer.subarray(0, 4).toString() === 'RIFF'
    && file.buffer.subarray(8, 12).toString() === 'WEBP';
  const signatureMatches =
    (file.mimetype === 'image/png' && !!png)
    || (file.mimetype === 'image/jpeg' && !!jpg)
    || (file.mimetype === 'image/webp' && !!webp);
  if (file.buffer && !signatureMatches) {
    throw new BadRequestException('Le contenu du fichier ne correspond pas à une image PNG, JPEG ou WebP.');
  }
  return type;
}

@Injectable()
export class TypeSupportsService {
  private readonly logger = new Logger(TypeSupportsService.name);
  constructor(
    @InjectRepository(TypeSupport)
    private readonly repository: Repository<TypeSupport>,
    private readonly cache: CacheService,
    private readonly storage: StorageService,
  ) {}

  async create(dto: CreateTypeSupportDto): Promise<TypeSupportWithLogoUrl> {
    const entity = this.repository.create({ ...dto, creationDate: new Date() });
    const saved = await this.repository.save(entity);
    await this.invalidate();
    return this.toView(saved);
  }

  async findAll(): Promise<TypeSupportWithLogoUrl[]> {
    const cached = await this.cache.get<TypeSupport[]>('type-supports:list');
    if (cached) return Promise.all(cached.map((item) => this.toView(item)));
    const result = await this.repository.find();
    await this.cache.set('type-supports:list', result);
    return Promise.all(result.map((item) => this.toView(item)));
  }

  async findOne(id: number): Promise<TypeSupportWithLogoUrl> {
    const cached = await this.cache.get<TypeSupport>(`type-supports:one:${id}`);
    if (cached) return this.toView(cached);
    const entity = await this.findOneFromDatabase(id);
    await this.cache.set(`type-supports:one:${id}`, entity);
    return this.toView(entity);
  }

  private async findOneFromDatabase(id: number): Promise<TypeSupport> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException(`TypeSupport ${id} introuvable.`);
    }
    return entity;
  }

  async update(id: number, dto: UpdateTypeSupportDto): Promise<TypeSupportWithLogoUrl> {
    const entity = await this.findOneFromDatabase(id);
    Object.assign(entity, dto);
    const saved = await this.repository.save(entity);
    await this.invalidate();
    return this.toView(saved);
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOneFromDatabase(id);
    if (entity.logoPath) await this.deletePreviousLogo(entity.logoPath);
    await this.repository.remove(entity);
    await this.invalidate();
  }

  async uploadLogo(id: number, file: Express.Multer.File): Promise<TypeSupportWithLogoUrl> {
    const entity = await this.findOneFromDatabase(id);
    const validation = validateLogoFile(file);
    const key = `logos/${id}-${randomUUID()}.${validation.ext}`;
    await this.storage.upload(key, file.buffer, validation.contentType);

    const previousKey = entity.logoPath;
    entity.logoPath = key;
    let saved: TypeSupport;
    try {
      saved = await this.repository.save(entity);
    } catch (error) {
      await this.deleteBestEffort(key);
      throw error;
    }

    if (previousKey) await this.deleteBestEffort(previousKey);
    await this.invalidate();
    return this.toView(saved);
  }

  async removeLogo(id: number): Promise<TypeSupportWithLogoUrl> {
    const entity = await this.findOneFromDatabase(id);
    const previousKey = entity.logoPath;
    if (!previousKey) return this.toView(entity);

    entity.logoPath = undefined;
    const saved = await this.repository.save(entity);
    await this.deleteBestEffort(previousKey);
    await this.invalidate();
    return this.toView(saved);
  }

  private async toView(entity: TypeSupport): Promise<TypeSupportWithLogoUrl> {
    return {
      ...entity,
      logoUrl: await this.storage.getUrl(entity.logoPath ?? ''),
    };
  }

  private async deletePreviousLogo(key: string): Promise<void> {
    await this.deleteBestEffort(key);
  }

  private async deleteBestEffort(key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.storage.logDeleteError(error);
    }
  }

  private async invalidate(): Promise<void> {
    try {
      await this.cache.invalidateResource('type-support');
    } catch (error) {
      this.logger.warn(`Cache invalidation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
