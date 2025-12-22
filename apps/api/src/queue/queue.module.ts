import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { RepoSyncProcessor } from './processors/repo-sync.processor';
import { ScanProcessor } from './processors/scan.processor';

// Queue names
export const REPO_SYNC_QUEUE = 'repo-sync';
export const SCAN_QUEUE = 'scan';
export const ANALYSIS_QUEUE = 'analysis';
export const EMBEDDING_QUEUE = 'embedding';

@Module({
  imports: [
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
  ],
  providers: [RepoSyncProcessor, ScanProcessor],
  exports: [BullModule],
})
export class QueueModule {}
