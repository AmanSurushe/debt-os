import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Scan } from './entities/scan.entity';
import { ScanService } from './scan.service';
import { ScanController } from './scan.controller';
import { QueueModule } from '../../queue/queue.module';
import { RepoModule } from '../repo/repo.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Scan]),
    QueueModule,
    RepoModule,
  ],
  controllers: [ScanController],
  providers: [ScanService],
  exports: [ScanService],
})
export class ScanModule {}
