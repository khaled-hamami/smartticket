import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Solution } from './entities/solution.entity';
import { User } from '../users/entities/user.entity';
import { CreateSolutionDto } from './dto/create-solution.dto';
import { UpdateSolutionDto } from './dto/update-solution.dto';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class SolutionsService {
  private readonly logger = new Logger(SolutionsService.name);
  constructor(
    @InjectRepository(Solution)
    private readonly repository: Repository<Solution>,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateSolutionDto): Promise<Solution> {
    const { proposedParId, ...rest } = dto;
    const entity = this.repository.create({
      ...rest,
      creationDate: new Date(),
      proposedPar: proposedParId ? ({ id: proposedParId } as User) : undefined,
    });
    const saved = await this.repository.save(entity);
    await this.invalidate();
    return saved;
  }

  async findAll(): Promise<Solution[]> {
    const cached = await this.cache.get<Solution[]>('solutions:list');
    if (cached) return cached;
    const result = await this.repository.find({ relations: ['proposedPar'] });
    await this.cache.set('solutions:list', result);
    return result;
  }

  async findOne(id: number): Promise<Solution> {
    const cached = await this.cache.get<Solution>(`solutions:one:${id}`);
    if (cached) return cached;
    const entity = await this.findOneFromDatabase(id);
    await this.cache.set(`solutions:one:${id}`, entity);
    return entity;
  }

  private async findOneFromDatabase(id: number): Promise<Solution> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: ['proposedPar'],
    });
    if (!entity) {
      throw new NotFoundException(`Solution ${id} introuvable.`);
    }
    return entity;
  }

  async update(id: number, dto: UpdateSolutionDto): Promise<Solution> {
    const entity = await this.findOneFromDatabase(id);
    const { proposedParId, ...rest } = dto;
    Object.assign(entity, rest);
    if (proposedParId !== undefined) {
      entity.proposedPar = proposedParId ? ({ id: proposedParId } as User) : undefined;
    }
    const saved = await this.repository.save(entity);
    await this.invalidate();
    return saved;
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOneFromDatabase(id);
    await this.repository.remove(entity);
    await this.invalidate();
  }

  private async invalidate(): Promise<void> {
    try {
      await this.cache.invalidateResource('solution');
    } catch (error) {
      this.logger.warn(`Cache invalidation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
