import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Site } from './entities/site.entity';
import { Equipment } from '../equipment/entities/equipment.entity';
import { EquipmentSoft } from '../equipment-softs/entities/equipment-soft.entity';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { LinkEquipmentDto } from './dto/link-equipment.dto';
import { LinkEquipmentSoftDto } from './dto/link-equipment-soft.dto';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class SitesService {
  private readonly logger = new Logger(SitesService.name);
  constructor(
    @InjectRepository(Site)
    private readonly sitesRepository: Repository<Site>,
    @InjectRepository(Equipment)
    private readonly equipmentRepository: Repository<Equipment>,
    @InjectRepository(EquipmentSoft)
    private readonly equipmentSoftRepository: Repository<EquipmentSoft>,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateSiteDto): Promise<Site> {
    const entity = this.sitesRepository.create(dto);
    const saved = await this.sitesRepository.save(entity);
    await this.invalidate();
    return saved;
  }

  async findAll(): Promise<Site[]> {
    const cached = await this.cache.get<Site[]>('sites:list');
    if (cached) return cached;
    const result = await this.sitesRepository.find({ relations: ['equipment', 'equipmentSofts'] });
    await this.cache.set('sites:list', result);
    return result;
  }

  async findOne(id: number): Promise<Site> {
    const cached = await this.cache.get<Site>(`sites:one:${id}`);
    if (cached) return cached;
    const entity = await this.findOneFromDatabase(id);
    await this.cache.set(`sites:one:${id}`, entity);
    return entity;
  }

  private async findOneFromDatabase(id: number): Promise<Site> {
    const entity = await this.sitesRepository.findOne({
      where: { id },
      relations: ['equipment', 'equipmentSofts'],
    });
    if (!entity) {
      throw new NotFoundException(`Site ${id} introuvable.`);
    }
    return entity;
  }

  async update(id: number, dto: UpdateSiteDto): Promise<Site> {
    const entity = await this.findOneFromDatabase(id);
    Object.assign(entity, dto);
    const saved = await this.sitesRepository.save(entity);
    await this.invalidate();
    return saved;
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOneFromDatabase(id);
    await this.sitesRepository.remove(entity);
    await this.invalidate();
  }

  async linkEquipment(siteId: number, dto: LinkEquipmentDto): Promise<Site> {
    const site = await this.findOneFromDatabase(siteId);
    const equipment = await this.equipmentRepository.findOne({
      where: { id: dto.equipmentId },
    });
    if (!equipment) {
      throw new NotFoundException(`Equipment ${dto.equipmentId} introuvable.`);
    }
    site.equipment = [...(site.equipment ?? []), equipment];
    const saved = await this.sitesRepository.save(site);
    await this.invalidate();
    await this.invalidateResource('equipment');
    return saved;
  }

  async unlinkEquipment(siteId: number, equipmentId: number): Promise<Site> {
    const site = await this.findOneFromDatabase(siteId);
    site.equipment = (site.equipment ?? []).filter((e) => String(e.id) !== String(equipmentId));
    const saved = await this.sitesRepository.save(site);
    await this.invalidate();
    await this.invalidateResource('equipment');
    return saved;
  }

  async linkEquipmentSoft(siteId: number, dto: LinkEquipmentSoftDto): Promise<Site> {
    const site = await this.findOneFromDatabase(siteId);
    const equipmentSoft = await this.equipmentSoftRepository.findOne({
      where: { id: dto.equipmentSoftId },
    });
    if (!equipmentSoft) {
      throw new NotFoundException(`EquipmentSoft ${dto.equipmentSoftId} introuvable.`);
    }
    site.equipmentSofts = [...(site.equipmentSofts ?? []), equipmentSoft];
    const saved = await this.sitesRepository.save(site);
    await this.invalidate();
    await this.invalidateResource('equipment-soft');
    return saved;
  }

  async unlinkEquipmentSoft(siteId: number, equipmentSoftId: number): Promise<Site> {
    const site = await this.findOneFromDatabase(siteId);
    site.equipmentSofts = (site.equipmentSofts ?? []).filter(
      (e) => String(e.id) !== String(equipmentSoftId),
    );
    const saved = await this.sitesRepository.save(site);
    await this.invalidate();
    await this.invalidateResource('equipment-soft');
    return saved;
  }

  private async invalidate(): Promise<void> {
    await this.invalidateResource('site');
  }

  private async invalidateResource(resource: 'equipment' | 'equipment-soft' | 'site'): Promise<void> {
    try {
      await this.cache.invalidateResource(resource);
    } catch (error) {
      this.logger.warn(`Cache invalidation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
