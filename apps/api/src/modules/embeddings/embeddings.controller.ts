import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { EmbeddingsService } from './embeddings.service';

class SimilaritySearchDto {
  query: string;
  repositoryId: string;
  limit?: number;
  threshold?: number;
  fileTypes?: string[];
  paths?: string[];
  scanId?: string;
}

class SimilarityResultDto {
  fileSnapshotId: string;
  filePath: string;
  chunkIndex: number;
  content: string;
  startLine: number;
  endLine: number;
  similarity: number;
}

class EmbeddingStatsDto {
  totalFiles: number;
  embeddedFiles: number;
  pendingFiles: number;
  failedFiles: number;
  totalChunks: number;
}

@ApiTags('embeddings')
@Controller('embeddings')
export class EmbeddingsController {
  constructor(private readonly embeddingsService: EmbeddingsService) {}

  @Post('search')
  @ApiOperation({ summary: 'Search for similar code using semantic similarity' })
  @ApiBody({ type: SimilaritySearchDto })
  @ApiResponse({
    status: 200,
    description: 'Similar code chunks found',
    type: [SimilarityResultDto],
  })
  async searchSimilar(
    @Body() body: SimilaritySearchDto,
  ): Promise<SimilarityResultDto[]> {
    if (!this.embeddingsService.isConfigured()) {
      throw new HttpException(
        'Embeddings service not configured - missing OPENAI_API_KEY',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    if (!body.query || !body.repositoryId) {
      throw new HttpException(
        'Query and repositoryId are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.embeddingsService.searchSimilar({
      query: body.query,
      repositoryId: body.repositoryId,
      limit: body.limit,
      threshold: body.threshold,
      filters: {
        fileTypes: body.fileTypes,
        paths: body.paths,
        scanId: body.scanId,
      },
    });
  }

  @Get('status')
  @ApiOperation({ summary: 'Check if embeddings service is configured' })
  @ApiResponse({
    status: 200,
    description: 'Service status',
  })
  getStatus(): { configured: boolean } {
    return { configured: this.embeddingsService.isConfigured() };
  }

  @Get('stats/:repositoryId')
  @ApiOperation({ summary: 'Get embedding statistics for a repository' })
  @ApiResponse({
    status: 200,
    description: 'Embedding statistics',
    type: EmbeddingStatsDto,
  })
  async getStats(
    @Param('repositoryId') repositoryId: string,
  ): Promise<EmbeddingStatsDto> {
    return this.embeddingsService.getRepositoryStats(repositoryId);
  }
}
