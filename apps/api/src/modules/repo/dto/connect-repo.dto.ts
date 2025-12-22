import { IsString, IsEnum, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectRepoDto {
  @ApiProperty({
    description: 'Git provider',
    enum: ['github', 'gitlab'],
    example: 'github',
  })
  @IsEnum(['github', 'gitlab'])
  provider: 'github' | 'gitlab';

  @ApiProperty({
    description: 'Full repository name (owner/repo)',
    example: 'owner/repo-name',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, {
    message: 'fullName must be in format owner/repo',
  })
  fullName: string;

  @ApiPropertyOptional({
    description: 'Clone URL for the repository',
    example: 'https://github.com/owner/repo-name.git',
  })
  @IsOptional()
  @IsString()
  cloneUrl?: string;

  @ApiPropertyOptional({
    description: 'External ID from the provider',
  })
  @IsOptional()
  @IsString()
  externalId?: string;

  @ApiPropertyOptional({
    description: 'Default branch name',
    example: 'main',
  })
  @IsOptional()
  @IsString()
  defaultBranch?: string;
}
