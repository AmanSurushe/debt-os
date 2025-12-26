import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { RepoModule } from './modules/repo/repo.module';
import { ScanModule } from './modules/scan/scan.module';
import { DebtModule } from './modules/debt/debt.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { HealthModule } from './modules/health/health.module';
import { EmbeddingsModule } from './modules/embeddings/embeddings.module';
import { LLMModule } from './modules/llm/llm.module';
import { GitModule } from './modules/git/git.module';
import { AgentsModule } from './modules/agents/agents.module';
import { MemoryModule } from './modules/memory/memory.module';
import { QueueModule } from './queue/queue.module';

import configuration from './config/configuration';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Database
    DatabaseModule,

    // Queue (BullMQ)
    QueueModule,

    // Feature modules
    AuthModule,
    RepoModule,
    ScanModule,
    DebtModule,
    WebhookModule,
    HealthModule,
    EmbeddingsModule,
    LLMModule,
    GitModule,
    AgentsModule,
    MemoryModule,
  ],
})
export class AppModule {}
