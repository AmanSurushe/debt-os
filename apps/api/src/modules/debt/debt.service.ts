import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DebtItem, DebtType, DebtSeverity, DebtStatus } from './entities/debt-item.entity';
import { RepoService } from '../repo/repo.service';

interface DebtFilters {
  types?: DebtType[];
  severities?: DebtSeverity[];
  statuses?: DebtStatus[];
  filePath?: string;
}

interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

@Injectable()
export class DebtService {
  constructor(
    @InjectRepository(DebtItem)
    private debtRepository: Repository<DebtItem>,
    private repoService: RepoService,
  ) {}

  async findByRepository(
    repositoryId: string,
    userId: string,
    filters: DebtFilters = {},
    pagination: PaginationOptions = {},
  ) {
    // Verify access
    await this.repoService.findById(repositoryId, userId);

    const { page = 1, pageSize = 20 } = pagination;

    const query = this.debtRepository
      .createQueryBuilder('debt')
      .where('debt.repositoryId = :repositoryId', { repositoryId })
      .orderBy('debt.createdAt', 'DESC');

    if (filters.types?.length) {
      query.andWhere('debt.debtType IN (:...types)', { types: filters.types });
    }

    if (filters.severities?.length) {
      query.andWhere('debt.severity IN (:...severities)', {
        severities: filters.severities,
      });
    }

    if (filters.statuses?.length) {
      query.andWhere('debt.status IN (:...statuses)', {
        statuses: filters.statuses,
      });
    }

    if (filters.filePath) {
      query.andWhere('debt.filePath LIKE :filePath', {
        filePath: `%${filters.filePath}%`,
      });
    }

    const [items, total] = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findByScan(scanId: string): Promise<DebtItem[]> {
    return this.debtRepository.find({
      where: { scanId },
      order: { severity: 'ASC', createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<DebtItem> {
    const item = await this.debtRepository.findOne({
      where: { id },
      relations: ['scan', 'repository'],
    });

    if (!item) {
      throw new NotFoundException('Debt item not found');
    }

    return item;
  }

  async updateStatus(id: string, status: DebtStatus): Promise<DebtItem> {
    const item = await this.findById(id);
    item.status = status;
    return this.debtRepository.save(item);
  }

  async getHotspots(repositoryId: string, userId: string, limit = 10) {
    // Verify access
    await this.repoService.findById(repositoryId, userId);

    const results = await this.debtRepository
      .createQueryBuilder('debt')
      .select('debt.filePath', 'filePath')
      .addSelect('COUNT(*)', 'count')
      .addSelect(
        'SUM(CASE WHEN debt.severity = :critical THEN 4 WHEN debt.severity = :high THEN 3 WHEN debt.severity = :medium THEN 2 ELSE 1 END)',
        'score',
      )
      .where('debt.repositoryId = :repositoryId', { repositoryId })
      .andWhere('debt.status IN (:...statuses)', {
        statuses: ['open', 'acknowledged'],
      })
      .setParameters({ critical: 'critical', high: 'high', medium: 'medium' })
      .groupBy('debt.filePath')
      .orderBy('score', 'DESC')
      .limit(limit)
      .getRawMany();

    return results;
  }

  async getTrends(repositoryId: string, userId: string, days = 30) {
    // Verify access
    await this.repoService.findById(repositoryId, userId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await this.debtRepository
      .createQueryBuilder('debt')
      .select("DATE_TRUNC('day', debt.createdAt)", 'date')
      .addSelect('COUNT(*)', 'newItems')
      .addSelect('debt.severity', 'severity')
      .where('debt.repositoryId = :repositoryId', { repositoryId })
      .andWhere('debt.createdAt >= :startDate', { startDate })
      .groupBy("DATE_TRUNC('day', debt.createdAt)")
      .addGroupBy('debt.severity')
      .orderBy('date', 'ASC')
      .getRawMany();

    return results;
  }

  async create(data: Partial<DebtItem>): Promise<DebtItem> {
    const item = this.debtRepository.create(data);
    return this.debtRepository.save(item);
  }

  async createMany(items: Partial<DebtItem>[]): Promise<DebtItem[]> {
    const entities = this.debtRepository.create(items);
    return this.debtRepository.save(entities);
  }
}
