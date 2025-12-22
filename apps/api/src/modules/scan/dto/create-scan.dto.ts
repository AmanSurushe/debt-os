import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScanDto {
  @ApiPropertyOptional({
    description: 'Branch to scan',
    example: 'main',
  })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiPropertyOptional({
    description: 'Specific commit SHA to scan',
    example: 'abc123def456',
  })
  @IsOptional()
  @IsString()
  commitSha?: string;

  @ApiPropertyOptional({
    description: 'Analysis depth',
    enum: ['quick', 'standard', 'full'],
    default: 'standard',
  })
  @IsOptional()
  @IsEnum(['quick', 'standard', 'full'])
  analysisDepth?: 'quick' | 'standard' | 'full';
}
