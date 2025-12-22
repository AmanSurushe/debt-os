import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { Repository, RepositorySettings } from './entities/repository.entity';
import { ConnectRepoDto } from './dto/connect-repo.dto';
import { UpdateRepoSettingsDto } from './dto/update-repo-settings.dto';

@Injectable()
export class RepoService {
  constructor(
    @InjectRepository(Repository)
    private repoRepository: TypeOrmRepository<Repository>,
    @InjectQueue('repo-sync')
    private repoSyncQueue: Queue,
  ) {}

  async connect(userId: string, dto: ConnectRepoDto): Promise<Repository> {
    // Check if already connected
    const existing = await this.repoRepository.findOne({
      where: {
        fullName: dto.fullName,
        provider: dto.provider,
        userId,
      },
    });

    if (existing) {
      throw new ConflictException('Repository already connected');
    }

    // Parse owner and name from fullName
    const [ownerName, name] = dto.fullName.split('/');

    const repo = this.repoRepository.create({
      externalId: dto.externalId || uuidv4(),
      provider: dto.provider,
      ownerName,
      name,
      fullName: dto.fullName,
      defaultBranch: dto.defaultBranch || 'main',
      cloneUrl: dto.cloneUrl,
      userId,
      settings: {
        autoScan: true,
        scanOnPush: true,
        scanOnPr: true,
        excludePaths: ['node_modules', 'dist', 'build', '.git', 'vendor'],
        includePaths: [],
      },
    });

    await this.repoRepository.save(repo);

    // Queue initial sync
    await this.repoSyncQueue.add(
      'sync-repo',
      { repositoryId: repo.id },
      { priority: 1 },
    );

    return repo;
  }

  async findAll(userId: string): Promise<Repository[]> {
    return this.repoRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findById(id: string, userId: string): Promise<Repository> {
    const repo = await this.repoRepository.findOne({
      where: { id, userId },
    });

    if (!repo) {
      throw new NotFoundException('Repository not found');
    }

    return repo;
  }

  async updateSettings(
    id: string,
    userId: string,
    dto: UpdateRepoSettingsDto,
  ): Promise<Repository> {
    const repo = await this.findById(id, userId);

    repo.settings = {
      ...repo.settings,
      ...dto,
    };

    await this.repoRepository.save(repo);
    return repo;
  }

  async disconnect(id: string, userId: string): Promise<void> {
    const repo = await this.findById(id, userId);
    await this.repoRepository.remove(repo);
  }

  async triggerSync(id: string, userId: string): Promise<void> {
    const repo = await this.findById(id, userId);

    await this.repoSyncQueue.add(
      'sync-repo',
      { repositoryId: repo.id },
      { priority: 1 },
    );
  }

  async updateSyncTimestamp(id: string): Promise<void> {
    await this.repoRepository.update(id, {
      lastSyncedAt: new Date(),
    });
  }

  async updateWebhook(
    id: string,
    webhookId: string,
    webhookSecret: string,
  ): Promise<void> {
    await this.repoRepository.update(id, {
      webhookId,
      webhookSecret,
    });
  }
}
