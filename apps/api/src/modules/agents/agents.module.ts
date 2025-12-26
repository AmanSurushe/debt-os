import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AgentsService } from './agents.service';
import { Scan } from '../scan/entities/scan.entity';
import { Repository } from '../repo/entities/repository.entity';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { GitModule } from '../git/git.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Scan, Repository]),
    ConfigModule,
    EmbeddingsModule,
    GitModule,
  ],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
