import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmbeddingsController } from './embeddings.controller';
import { EmbeddingsService } from './embeddings.service';
import { FileSnapshot } from '../scan/entities/file-snapshot.entity';
import { FileEmbedding } from '../scan/entities/file-embedding.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([FileSnapshot, FileEmbedding]),
  ],
  controllers: [EmbeddingsController],
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
