import { IsBoolean, IsArray, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRepoSettingsDto {
  @ApiPropertyOptional({ description: 'Enable automatic scanning' })
  @IsOptional()
  @IsBoolean()
  autoScan?: boolean;

  @ApiPropertyOptional({ description: 'Scan on push events' })
  @IsOptional()
  @IsBoolean()
  scanOnPush?: boolean;

  @ApiPropertyOptional({ description: 'Scan on pull request events' })
  @IsOptional()
  @IsBoolean()
  scanOnPr?: boolean;

  @ApiPropertyOptional({
    description: 'Paths to exclude from scanning',
    example: ['node_modules', 'dist', '.git'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludePaths?: string[];

  @ApiPropertyOptional({
    description: 'Paths to include in scanning (empty = all)',
    example: ['src', 'lib'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includePaths?: string[];
}
