import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtItem } from './entities/debt-item.entity';
import { DebtService } from './debt.service';
import { DebtController } from './debt.controller';
import { RepoModule } from '../repo/repo.module';

@Module({
  imports: [TypeOrmModule.forFeature([DebtItem]), RepoModule],
  controllers: [DebtController],
  providers: [DebtService],
  exports: [DebtService],
})
export class DebtModule {}
