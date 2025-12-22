import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { Repository } from '../repo/entities/repository.entity';
import { ScanModule } from '../scan/scan.module';

@Module({
  imports: [TypeOrmModule.forFeature([Repository]), ScanModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
