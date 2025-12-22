import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DebtStatus } from '../entities/debt-item.entity';

export class UpdateDebtStatusDto {
  @ApiProperty({
    description: 'New status for the debt item',
    enum: ['open', 'acknowledged', 'planned', 'in_progress', 'resolved', 'wont_fix'],
  })
  @IsEnum(['open', 'acknowledged', 'planned', 'in_progress', 'resolved', 'wont_fix'])
  status: DebtStatus;
}
