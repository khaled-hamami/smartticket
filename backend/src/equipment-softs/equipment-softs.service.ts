import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipmentSoft } from './entities/equipment-soft.entity';
import { EquipmentSoftTypeSupport } from './entities/equipmentsoft-type-support.entity';
import { CreateEquipmentSoftDto } from './dto/create-equipment-soft.dto';
import { UpdateEquipmentSoftDto } from './dto/update-equipment-soft.dto';
import { LinkTypeSupportDto } from './dto/link-type-support.dto';
import { assertDateRange } from '../common/validators/date-range';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class EquipmentSoftsService {
  private readonly logger = new Logger(EquipmentSoftsService.name);
  constructor(
    @InjectRepository(EquipmentSoft)
    private readonly repository: Repository<EquipmentSoft>,
    @InjectRepository(EquipmentSoftTypeSupport)
    private readonly linkRepository: Repository<EquipmentSoftTypeSupport>,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateEquipmentSoftDto): Promise<EquipmentSoft> {
    assertDateRange(dto.startDateContract, dto.endDateContract, "La période du contrat du logiciel");
    const entity = this.repository.create(dto);
    const saved = await this.repository.save(entity);
    await this.invalidate();
    return saved;
  }

  async findAll(): Promise<EquipmentSoft[]> {
    const cached = await this.cache.get<EquipmentSoft[]>('equipment-softs:list');
    if (cached) return cached;
    const result = await this.repository.find({ relations: ['typeSupportLinks'] });
    await this.cache.set('equipment-softs:list', result);
    return result;
  }

  async findOne(id: number): Promise<EquipmentSoft> {
    const cached = await this.cache.get<EquipmentSoft>(`equipment-softs:one:${id}`);
    if (cached) return cached;
    const entity = await this.findOneFromDatabase(id);
    await this.cache.set(`equipment-softs:one:${id}`, entity);
    return entity;
  }

  private async findOneFromDatabase(id: number): Promise<EquipmentSoft> {
    const entity = await this.repository.findOne({
      where: { id },
      relations: ['typeSupportLinks'],
    });
    if (!entity) {
      throw new NotFoundException(`EquipmentSoft ${id} introuvable.`);
    }
    return entity;
  }

  async update(id: number, dto: UpdateEquipmentSoftDto): Promise<EquipmentSoft> {
    const entity = await this.findOneFromDatabase(id);
    assertDateRange(dto.startDateContract ?? entity.startDateContract, dto.endDateContract ?? entity.endDateContract, "La période du contrat du logiciel");
    Object.assign(entity, dto);
    const saved = await this.repository.save(entity);
    await this.invalidate();
    return saved;
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOneFromDatabase(id);
    await this.repository.remove(entity);
    await this.invalidate();
  }

  async linkTypeSupport(
    equipmentSoftId: number,
    dto: LinkTypeSupportDto,
  ): Promise<EquipmentSoftTypeSupport> {
    const equipmentSoft = await this.findOneFromDatabase(equipmentSoftId);
    const link = this.linkRepository.create({
      equipmentSoft,
      typeSupport: { id: dto.typeSupportId } as any,
      supportId: dto.supportId,
      startDateSupport: dto.startDateSupport,
      endDateSupport: dto.endDateSupport,
    });
    const saved = await this.linkRepository.save(link);
    await this.invalidate();
    return saved;
  }

  async unlinkTypeSupport(equipmentSoftId: number, linkId: number): Promise<void> {
    const link = await this.linkRepository.findOne({
      where: { id: linkId, equipmentSoft: { id: equipmentSoftId } },
      relations: ['equipmentSoft'],
    });
    if (!link) {
      throw new NotFoundException(
        `Lien TypeSupport ${linkId} introuvable pour l'equipmentsoft ${equipmentSoftId}.`,
      );
    }
    await this.linkRepository.remove(link);
    await this.invalidate();
  }

  private async invalidate(): Promise<void> {
    try {
      await this.cache.invalidateResource('equipment-soft');
    } catch (error) {
      this.logger.warn(`Cache invalidation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
