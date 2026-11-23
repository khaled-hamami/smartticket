import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { ContractTechnician } from './entities/contract-technician.entity';
import { ContractTypeSupport } from './entities/contract-type-support.entity';
import { User } from '../users/entities/user.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { LinkClientDto } from './dto/link-client.dto';
import { LinkTechnicianDto } from './dto/link-technician.dto';
import { LinkTypeSupportDto } from './dto/link-type-support.dto';
import { assertDateRange, assertNonNegativeAmount } from '../common/validators/date-range';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);
  constructor(
    @InjectRepository(Contract)
    private readonly contractsRepository: Repository<Contract>,
    @InjectRepository(ContractTechnician)
    private readonly technicianLinkRepository: Repository<ContractTechnician>,
    @InjectRepository(ContractTypeSupport)
    private readonly typeSupportLinkRepository: Repository<ContractTypeSupport>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly cache: CacheService,
  ) {}

  async create(dto: CreateContractDto): Promise<Contract> {
    assertDateRange(dto.startDate, dto.endDate, 'La période du contrat');
    assertNonNegativeAmount(dto.montant);
    const { commercialId, ...rest } = dto;
    const entity = this.contractsRepository.create({
      ...rest,
      commercial: commercialId ? ({ id: commercialId } as User) : undefined,
    });
    const saved = await this.contractsRepository.save(entity);
    await this.invalidate();
    return saved;
  }

  async findAll(): Promise<Contract[]> {
    const cached = await this.cache.get<Contract[]>('contracts:list');
    if (cached) return cached;
    const result = await this.contractsRepository.find({
      relations: ['commercial', 'clients', 'technicianLinks', 'typeSupportLinks'],
    });
    await this.cache.set('contracts:list', result);
    return result;
  }

  async findOne(id: number): Promise<Contract> {
    const cached = await this.cache.get<Contract>(`contracts:one:${id}`);
    if (cached) return cached;
    const entity = await this.findOneFromDatabase(id);
    await this.cache.set(`contracts:one:${id}`, entity);
    return entity;
  }

  private async findOneFromDatabase(id: number): Promise<Contract> {
    const entity = await this.contractsRepository.findOne({
      where: { id },
      relations: [
        'commercial',
        'clients',
        'technicianLinks',
        'technicianLinks.technician',
        'typeSupportLinks',
        'typeSupportLinks.typeSupport',
      ],
    });
    if (!entity) {
      throw new NotFoundException(`Contract ${id} introuvable.`);
    }
    return entity;
  }

  async update(id: number, dto: UpdateContractDto): Promise<Contract> {
    const entity = await this.findOneFromDatabase(id);
    assertDateRange(dto.startDate ?? entity.startDate, dto.endDate ?? entity.endDate, 'La période du contrat');
    assertNonNegativeAmount(dto.montant);
    const { commercialId, ...rest } = dto;
    Object.assign(entity, rest);
    if (commercialId !== undefined) {
      entity.commercial = commercialId ? ({ id: commercialId } as User) : undefined;
    }
    const saved = await this.contractsRepository.save(entity);
    await this.invalidate();
    return saved;
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOneFromDatabase(id);
    await this.contractsRepository.remove(entity);
    await this.invalidate();
  }

  async linkClient(contractId: number, dto: LinkClientDto): Promise<Contract> {
    const contract = await this.findOneFromDatabase(contractId);
    const client = await this.usersRepository.findOne({ where: { id: dto.clientId } });
    if (!client) {
      throw new NotFoundException(`User ${dto.clientId} introuvable.`);
    }
    contract.clients = [...(contract.clients ?? []), client];
    const saved = await this.contractsRepository.save(contract);
    await this.invalidate();
    return saved;
  }

  async unlinkClient(contractId: number, clientId: number): Promise<Contract> {
    const contract = await this.findOneFromDatabase(contractId);
    contract.clients = (contract.clients ?? []).filter((c) => String(c.id) !== String(clientId));
    const saved = await this.contractsRepository.save(contract);
    await this.invalidate();
    return saved;
  }

  async linkTechnician(
    contractId: number,
    dto: LinkTechnicianDto,
  ): Promise<ContractTechnician> {
    const contract = await this.findOneFromDatabase(contractId);
    const link = this.technicianLinkRepository.create({
      contract,
      technician: { id: dto.technicianId } as User,
      teamLeader: dto.teamLeader ?? false,
    });
    const saved = await this.technicianLinkRepository.save(link);
    await this.invalidate();
    return saved;
  }

  async unlinkTechnician(contractId: number, technicianId: number): Promise<void> {
    const link = await this.technicianLinkRepository.findOne({
      where: { contractId, technicianId },
    });
    if (!link) {
      throw new NotFoundException(
        `Lien technicien ${technicianId} introuvable pour le contrat ${contractId}.`,
      );
    }
    await this.technicianLinkRepository.remove(link);
    await this.invalidate();
  }

  async linkTypeSupport(
    contractId: number,
    dto: LinkTypeSupportDto,
  ): Promise<ContractTypeSupport> {
    const contract = await this.findOneFromDatabase(contractId);
    const link = this.typeSupportLinkRepository.create({
      contract,
      typeSupport: { id: dto.typeSupportId } as any,
      supportId: dto.supportId,
    });
    const saved = await this.typeSupportLinkRepository.save(link);
    await this.invalidate();
    return saved;
  }

  async unlinkTypeSupport(contractId: number, linkId: number): Promise<void> {
    const link = await this.typeSupportLinkRepository.findOne({
      where: { id: linkId, contract: { id: contractId } },
      relations: ['contract'],
    });
    if (!link) {
      throw new NotFoundException(
        `Lien TypeSupport ${linkId} introuvable pour le contrat ${contractId}.`,
      );
    }
    await this.typeSupportLinkRepository.remove(link);
    await this.invalidate();
  }

  private async invalidate(): Promise<void> {
    try {
      await this.cache.invalidateResource('contract');
    } catch (error) {
      this.logger.warn(`Cache invalidation failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
