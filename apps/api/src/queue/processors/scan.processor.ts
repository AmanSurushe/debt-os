import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import * as crypto from 'crypto';
import { Scan } from '../../modules/scan/entities/scan.entity';
import { Repository } from '../../modules/repo/entities/repository.entity';
import { FileSnapshot } from '../../modules/scan/entities/file-snapshot.entity';
import { GitService } from '@debt-os/git';
import { detectLanguage } from '@debt-os/embeddings';
import { EMBEDDING_QUEUE } from '../queue.module';
import { EmbeddingJobData } from './embedding.processor';

interface ScanJobData {
  scanId: string;
  repositoryId: string;
  commitSha: string;
  branch: string;
}

const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm',
  '.exe', '.dll', '.so', '.dylib',
  '.lock', '.min.js', '.min.css',
]);

const IGNORED_DIRECTORIES = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next',
  '.nuxt', '.cache', '__pycache__', '.pytest_cache', 'vendor',
  '.venv', 'venv', 'env', '.idea', '.vscode', 'target',
]);

@Processor('scan')
export class ScanProcessor extends WorkerHost {
  private readonly logger = new Logger(ScanProcessor.name);
  private gitService: GitService;

  constructor(
    @InjectRepository(Scan)
    private scanRepository: TypeOrmRepository<Scan>,
    @InjectRepository(Repository)
    private repositoryRepository: TypeOrmRepository<Repository>,
    @InjectRepository(FileSnapshot)
    private fileSnapshotRepository: TypeOrmRepository<FileSnapshot>,
    @InjectQueue(EMBEDDING_QUEUE)
    private embeddingQueue: Queue<EmbeddingJobData>,
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {
    super();
    const basePath = this.configService.get<string>('repoStorage.basePath') || '/tmp/debt-os/repos';
    this.gitService = new GitService({ basePath });
  }

  async process(job: Job<ScanJobData>): Promise<void> {
    const { scanId, repositoryId, branch } = job.data;
    const startTime = Date.now();

    this.logger.log(`Processing scan ${scanId} for ${repositoryId}@${branch}`);

    try {
      // Update status to ingesting
      await this.scanRepository.update(scanId, {
        status: 'ingesting',
        startedAt: new Date(),
      });
      await job.updateProgress(5);

      // Get repository details
      const repo = await this.repositoryRepository.findOne({
        where: { id: repositoryId },
        relations: ['owner'],
      });

      if (!repo) {
        throw new Error(`Repository ${repositoryId} not found`);
      }

      // Ensure repository is cloned/synced
      await this.ensureRepoSynced(repo);
      await job.updateProgress(15);

      // Phase 1: File Ingestion
      this.logger.log(`[${scanId}] Starting file ingestion...`);
      const { filesIngested, fileSnapshots } = await this.ingestFiles(
        scanId,
        repo,
        job,
      );
      await job.updateProgress(40);

      // Phase 2: Queue embedding jobs
      this.logger.log(`[${scanId}] Queueing embedding jobs for ${filesIngested} files...`);
      await this.queueEmbeddingJobs(fileSnapshots);
      await job.updateProgress(50);

      // Update status to analyzing (embeddings and future LLM analysis)
      await this.scanRepository.update(scanId, { status: 'analyzing' });

      // Phase 3: Analysis (placeholder for future LLM debt detection)
      this.logger.log(`[${scanId}] Analysis phase (embeddings queued)...`);
      await job.updateProgress(80);

      // Phase 4: Finalization
      this.logger.log(`[${scanId}] Finalizing scan...`);
      const durationMs = Date.now() - startTime;

      await this.scanRepository.update(scanId, {
        status: 'complete',
        completedAt: new Date(),
        stats: {
          filesAnalyzed: filesIngested,
          debtItemsFound: 0,
          totalTokensUsed: 0,
          totalCost: 0,
          durationMs,
        },
      });

      await job.updateProgress(100);
      this.logger.log(
        `Completed scan ${scanId} - ${filesIngested} files ingested in ${durationMs}ms`,
      );
    } catch (error) {
      this.logger.error(`Failed scan ${scanId}:`, error);
      await this.scanRepository.update(scanId, {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async ensureRepoSynced(repo: Repository): Promise<void> {
    const accessToken = repo.owner?.accessToken;

    if (!this.gitService.exists(repo.id)) {
      this.logger.log(`Cloning repository ${repo.fullName}...`);
      await this.gitService.clone(repo.id, {
        url: repo.cloneUrl,
        branch: repo.defaultBranch,
        token: accessToken,
      });
    } else {
      this.logger.log(`Pulling latest changes for ${repo.fullName}...`);
      await this.gitService.pull(repo.id, { branch: repo.defaultBranch });
    }
  }

  private async ingestFiles(
    scanId: string,
    repo: Repository,
    job: Job<ScanJobData>,
  ): Promise<{ filesIngested: number; fileSnapshots: Array<{ snapshot: FileSnapshot; content: string }> }> {
    // List all files in the repository
    const allFiles = await this.gitService.listFiles(repo.id);

    // Filter files based on settings and ignored patterns
    const filesToProcess = allFiles.filter((file) =>
      this.shouldProcessFile(file.path, repo.settings),
    );

    this.logger.log(
      `[${scanId}] Found ${allFiles.length} files, processing ${filesToProcess.length}`,
    );

    const fileSnapshots: Array<{ snapshot: FileSnapshot; content: string }> = [];
    const batchSize = 50;

    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      const batch = filesToProcess.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(async (file) => {
          try {
            const content = await this.gitService.getFileContent(repo.id, file.path);
            const contentHash = crypto.createHash('sha256').update(content).digest('hex');
            const lines = content.split('\n');
            const language = detectLanguage(file.path);

            const snapshot = this.fileSnapshotRepository.create({
              scanId,
              filePath: file.path,
              contentHash,
              language,
              lineCount: lines.length,
              sizeBytes: Buffer.byteLength(content, 'utf8'),
              embeddingStatus: 'pending',
            });

            await this.fileSnapshotRepository.save(snapshot);

            return { snapshot, content };
          } catch (error) {
            this.logger.warn(`Failed to process file ${file.path}:`, error);
            return null;
          }
        }),
      );

      fileSnapshots.push(
        ...batchResults.filter((r): r is { snapshot: FileSnapshot; content: string } => r !== null),
      );

      // Update progress within the ingestion phase (15-40%)
      const progress = 15 + Math.floor((i / filesToProcess.length) * 25);
      await job.updateProgress(progress);
    }

    return { filesIngested: fileSnapshots.length, fileSnapshots };
  }

  private shouldProcessFile(filePath: string, settings: Repository['settings']): boolean {
    // Check if file is in an ignored directory
    const pathParts = filePath.split('/');
    for (const part of pathParts.slice(0, -1)) {
      if (IGNORED_DIRECTORIES.has(part)) {
        return false;
      }
    }

    // Check file extension
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    if (IGNORED_EXTENSIONS.has(ext)) {
      return false;
    }

    // Check exclude paths from settings
    if (settings?.excludePaths?.length) {
      for (const excludePath of settings.excludePaths) {
        if (this.matchesGlob(filePath, excludePath)) {
          return false;
        }
      }
    }

    // Check include paths from settings (if specified, only include matching files)
    if (settings?.includePaths?.length) {
      let matches = false;
      for (const includePath of settings.includePaths) {
        if (this.matchesGlob(filePath, includePath)) {
          matches = true;
          break;
        }
      }
      if (!matches) {
        return false;
      }
    }

    return true;
  }

  private matchesGlob(filePath: string, pattern: string): boolean {
    // Simple glob matching (supports * and **)
    const regexPattern = pattern
      .replace(/\*\*/g, '{{DOUBLE_STAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/{{DOUBLE_STAR}}/g, '.*');

    return new RegExp(`^${regexPattern}$`).test(filePath);
  }

  private async queueEmbeddingJobs(
    fileSnapshots: Array<{ snapshot: FileSnapshot; content: string }>,
  ): Promise<void> {
    const jobs = fileSnapshots.map((item) => ({
      name: 'embed-file',
      data: {
        fileSnapshotId: item.snapshot.id,
        filePath: item.snapshot.filePath,
        content: item.content,
      } as EmbeddingJobData,
      opts: {
        priority: 5,
        attempts: 2,
      },
    }));

    if (jobs.length > 0) {
      await this.embeddingQueue.addBulk(jobs);
      this.logger.log(`Queued ${jobs.length} embedding jobs`);
    }
  }
}
