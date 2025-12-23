import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmbeddingsService } from '../../modules/embeddings/embeddings.service';

export interface EmbeddingJobData {
  fileSnapshotId: string;
  filePath: string;
  content: string;
}

@Processor('embedding')
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(private readonly embeddingsService: EmbeddingsService) {
    super();
  }

  async process(job: Job<EmbeddingJobData>): Promise<void> {
    const { fileSnapshotId, filePath, content } = job.data;

    this.logger.log(`Processing embedding for ${filePath}`);

    try {
      await job.updateProgress(10);

      if (!this.embeddingsService.isConfigured()) {
        this.logger.warn(
          `Skipping embedding for ${filePath} - embeddings service not configured`,
        );
        return;
      }

      await this.embeddingsService.embedFile(fileSnapshotId, content, filePath);

      await job.updateProgress(100);
      this.logger.log(`Completed embedding for ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed embedding for ${filePath}:`, error);
      throw error;
    }
  }
}
