import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from './entities/repository.entity';
import { RepoService } from './repo.service';
import { RepoController } from './repo.controller';
import { QueueModule } from '../../queue/queue.module';

@Module({
  imports: [TypeOrmModule.forFeature([Repository]), QueueModule],
  controllers: [RepoController],
  providers: [RepoService],
  exports: [RepoService],
})
export class RepoModule {}
