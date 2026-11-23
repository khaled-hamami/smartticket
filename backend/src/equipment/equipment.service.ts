import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipment } from './entities/equipment.entity';
import { EquipmentTypeSupport } from './entities/equipment-type-support.entity';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { LinkTypeSupportDto } from './dto/link-type-support.dto';
import { assertDateRange } from '../common/validators/date-range';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class EquipmentService {
  private readonly logger = new Logger(EquipmentService.name);
  constructor(
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
    @InjectRepository(EquipmentTypeSupport)
    private readonly linkRepository: Repository<EquipmentTypeSupport>,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateEquipmentDto): Promise<Equipment> {
    assertDateRange(dto.startDateContract, dto.endDateContract, "La période du contrat de l'équipement");
    const entity = this.equipmentRepository.create(dto);
    const saved = await this.equipmentRepository.save(entity);
    await this.invalidate();
    return saved;
  }

  async findAll(): Promise<Equipment[]> {
    const cached = await this.cache.get<Equipment[]>('equipment:list');
    if (cached) return cached;
    const result = await this.equipmentRepository.find({ relations: ['typeSupportLinks'] });
    await this.cache.set('equipment:list', result);
    return result;
  }

  async findOne(id: number): Promise<Equipment> {
    const cached = await this.cache.get<Equipment>(`equipment:one:${id}`);
    if (cached) return cached;
    const entity = await this.findOneFromDatabase(id);
    await this.cache.set(`equipment:one:${id}`, entity);
    return entity;
  }

  private async findOneFromDatabase(id: number): Promise<Equipment> {
    const entity = await this.equipmentRepository.findOne({
      where: { id },
      relations: ['typeSupportLinks'],
    });
    if (!entity) {
      throw new NotFoundException(`Equipment ${id} introuvable.`);
    }
    return entity;
  }

  async update(id: number, dto: UpdateEquipmentDto): Promise<Equipment> {
    const entity = await this.findOneFromDatabase(id);
    assertDateRange(dto.startDateContract ?? entity.startDateContract, dto.endDateContract ?? entity.endDateContract, "La période du contrat de l'équipement");
    Object.assign(entity, dto);
    const saved = await this.equipmentRepository.save(entity);
    await this.invalidate();
    return saved;
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOneFromDatabase(id);
    await this.equipmentRepository.remove(entity);
    await this.invalidate();
  }

  async linkTypeSupport(
    equipmentId: number,
    dto: LinkTypeSupportDto,
  ): Promise<EquipmentTypeSupport> {
    const equipment = await this.findOneFromDatabase(equipmentId);
    const link = this.linkRepository.create({
      equipment,
      typeSupport: { id: dto.typeSupportId } as any,
      supportId: dto.supportId,
      startDateSupport: dto.startDateSupport,
      endDateSupport: dto.endDateSupport,
    });
    const saved = await this.linkRepository.save(link);
    await this.invalidate();
    return saved;
  }

  async unlinkTypeSupport(equipmentId: number, linkId: number): Promise<void> {
    const link = await this.linkRepository.findOne({
      where: { id: linkId, equipment: { id: equipmentId } },
      relations: ['equipment'],
    });
    if (!link) {
      throw new NotFoundException(
        `Lien TypeSupport ${linkId} introuvable pour l'équipement ${equipmentId}.`,
      );
    }
    await this.linkRepository.remove(link);
    await this.invalidate();
  }

  private async invalidate(): Promise<void> {
    try {
      await this.cache.invalidateResource('equipment');
    } catch (error) {
      this.logger.warn(`Cache invalidation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
