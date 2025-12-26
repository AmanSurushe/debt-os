import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MemoryService } from './memory.service';
import { EmbeddingsModule } from '../embeddings/embeddings.module';

@Module({
  imports: [ConfigModule, EmbeddingsModule],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
