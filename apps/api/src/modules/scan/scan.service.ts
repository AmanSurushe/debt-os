import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Scan, ScanStatus, ScanTrigger } from './entities/scan.entity';
import { RepoService } from '../repo/repo.service';
import { CreateScanDto } from './dto/create-scan.dto';

@Injectable()
export class ScanService {
  constructor(
    @InjectRepository(Scan)
    private scanRepository: Repository<Scan>,
    @InjectQueue('scan')
    private scanQueue: Queue,
    private repoService: RepoService,
  ) {}

  async create(
    repositoryId: string,
    userId: string,
    dto: CreateScanDto,
  ): Promise<Scan> {
    // Verify repository exists and user has access
    const repo = await this.repoService.findById(repositoryId, userId);

    const scan = this.scanRepository.create({
      repositoryId: repo.id,
      commitSha: dto.commitSha || 'HEAD',
      branch: dto.branch || repo.defaultBranch,
      status: 'pending',
      triggeredBy: 'manual',
      triggeredById: userId,
      stats: {
        filesAnalyzed: 0,
        debtItemsFound: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        durationMs: 0,
      },
    });

    await this.scanRepository.save(scan);

    // Queue the scan
    await this.scanQueue.add(
      'run-scan',
      {
        scanId: scan.id,
        repositoryId: repo.id,
        commitSha: scan.commitSha,
        branch: scan.branch,
      },
      { priority: 1 },
    );

    return scan;
  }

  async createFromWebhook(
    repositoryId: string,
    commitSha: string,
    branch: string,
    trigger: ScanTrigger,
  ): Promise<Scan> {
    const scan = this.scanRepository.create({
      repositoryId,
      commitSha,
      branch,
      status: 'pending',
      triggeredBy: trigger,
      stats: {
        filesAnalyzed: 0,
        debtItemsFound: 0,
        totalTokensUsed: 0,
        totalCost: 0,
        durationMs: 0,
      },
    });

    await this.scanRepository.save(scan);

    await this.scanQueue.add(
      'run-scan',
      {
        scanId: scan.id,
        repositoryId,
        commitSha,
        branch,
      },
      { priority: 2 },
    );

    return scan;
  }

  async findByRepository(repositoryId: string, userId: string): Promise<Scan[]> {
    // Verify access
    await this.repoService.findById(repositoryId, userId);

    return this.scanRepository.find({
      where: { repositoryId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findById(id: string): Promise<Scan> {
    const scan = await this.scanRepository.findOne({
      where: { id },
      relations: ['repository'],
    });

    if (!scan) {
      throw new NotFoundException('Scan not found');
    }

    return scan;
  }

  async updateStatus(
    id: string,
    status: ScanStatus,
    errorMessage?: string,
  ): Promise<void> {
    const updates: Partial<Scan> = { status };

    if (status === 'analyzing') {
      updates.startedAt = new Date();
    } else if (status === 'complete' || status === 'failed') {
      updates.completedAt = new Date();
    }

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    await this.scanRepository.update(id, updates);
  }

  async cancel(id: string, userId: string): Promise<void> {
    const scan = await this.findById(id);

    // Verify access
    await this.repoService.findById(scan.repositoryId, userId);

    if (scan.status === 'complete' || scan.status === 'failed') {
      throw new Error('Cannot cancel completed or failed scan');
    }

    await this.updateStatus(id, 'failed', 'Cancelled by user');
  }
}
