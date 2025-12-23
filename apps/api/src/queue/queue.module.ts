import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RepoSyncProcessor } from './processors/repo-sync.processor';
import { ScanProcessor } from './processors/scan.processor';
import { EmbeddingProcessor } from './processors/embedding.processor';
import { EmbeddingsModule } from '../modules/embeddings/embeddings.module';
import { Scan } from '../modules/scan/entities/scan.entity';
import { FileSnapshot } from '../modules/scan/entities/file-snapshot.entity';
import { Repository } from '../modules/repo/entities/repository.entity';

// Queue names
export const REPO_SYNC_QUEUE = 'repo-sync';
export const SCAN_QUEUE = 'scan';
export const ANALYSIS_QUEUE = 'analysis';
export const EMBEDDING_QUEUE = 'embedding';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Scan, FileSnapshot, Repository]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 1000,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: REPO_SYNC_QUEUE },
      { name: SCAN_QUEUE },
      { name: ANALYSIS_QUEUE },
      { name: EMBEDDING_QUEUE },
    ),
    forwardRef(() => EmbeddingsModule),
  ],
  providers: [RepoSyncProcessor, ScanProcessor, EmbeddingProcessor],
  exports: [BullModule],
})
export class QueueModule {}
