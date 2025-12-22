import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Sse,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Observable, interval, switchMap, from, map } from 'rxjs';
import { ScanService } from './scan.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { CreateScanDto } from './dto/create-scan.dto';

@ApiTags('scans')
@Controller()
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class ScanController {
  constructor(private scanService: ScanService) {}

  @Post('repos/:repoId/scans')
  @ApiOperation({ summary: 'Trigger a new scan' })
  async create(
    @CurrentUser() user: User,
    @Param('repoId') repoId: string,
    @Body() dto: CreateScanDto,
  ) {
    const scan = await this.scanService.create(repoId, user.id, dto);
    return {
      id: scan.id,
      status: scan.status,
      repositoryId: scan.repositoryId,
      branch: scan.branch,
      commitSha: scan.commitSha,
      createdAt: scan.createdAt,
    };
  }

  @Get('repos/:repoId/scans')
  @ApiOperation({ summary: 'List scans for a repository' })
  async listByRepo(
    @CurrentUser() user: User,
    @Param('repoId') repoId: string,
  ) {
    const scans = await this.scanService.findByRepository(repoId, user.id);
    return scans.map((scan) => ({
      id: scan.id,
      status: scan.status,
      branch: scan.branch,
      commitSha: scan.commitSha,
      triggeredBy: scan.triggeredBy,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      stats: scan.stats,
      createdAt: scan.createdAt,
    }));
  }

  @Get('scans/:id')
  @ApiOperation({ summary: 'Get scan details' })
  async findOne(@Param('id') id: string) {
    const scan = await this.scanService.findById(id);
    return {
      id: scan.id,
      status: scan.status,
      repositoryId: scan.repositoryId,
      branch: scan.branch,
      commitSha: scan.commitSha,
      triggeredBy: scan.triggeredBy,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      errorMessage: scan.errorMessage,
      stats: scan.stats,
      createdAt: scan.createdAt,
    };
  }

  @Sse('scans/:id/progress')
  @ApiOperation({ summary: 'SSE stream for scan progress' })
  progress(@Param('id') id: string): Observable<{ data: object }> {
    // Poll scan status every 2 seconds
    return interval(2000).pipe(
      switchMap(() =>
        from(this.scanService.findById(id)).pipe(
          map((scan) => ({
            data: {
              status: scan.status,
              stats: scan.stats,
            },
          })),
        ),
      ),
    );
  }

  @Delete('scans/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a running scan' })
  async cancel(@CurrentUser() user: User, @Param('id') id: string) {
    await this.scanService.cancel(id, user.id);
  }
}
