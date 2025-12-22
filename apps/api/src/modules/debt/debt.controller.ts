import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DebtService } from './debt.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { DebtType, DebtSeverity, DebtStatus } from './entities/debt-item.entity';
import { UpdateDebtStatusDto } from './dto/update-debt-status.dto';

@ApiTags('debt')
@Controller()
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class DebtController {
  constructor(private debtService: DebtService) {}

  @Get('repos/:repoId/debt')
  @ApiOperation({ summary: 'List debt items for a repository' })
  @ApiQuery({ name: 'type', required: false, enum: DebtType, isArray: true })
  @ApiQuery({ name: 'severity', required: false, enum: ['critical', 'high', 'medium', 'low', 'info'], isArray: true })
  @ApiQuery({ name: 'status', required: false, enum: ['open', 'acknowledged', 'planned', 'in_progress', 'resolved', 'wont_fix'], isArray: true })
  @ApiQuery({ name: 'filePath', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async listByRepo(
    @CurrentUser() user: User,
    @Param('repoId') repoId: string,
    @Query('type') types?: DebtType | DebtType[],
    @Query('severity') severities?: DebtSeverity | DebtSeverity[],
    @Query('status') statuses?: DebtStatus | DebtStatus[],
    @Query('filePath') filePath?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const result = await this.debtService.findByRepository(
      repoId,
      user.id,
      {
        types: types ? (Array.isArray(types) ? types : [types]) : undefined,
        severities: severities ? (Array.isArray(severities) ? severities : [severities]) : undefined,
        statuses: statuses ? (Array.isArray(statuses) ? statuses : [statuses]) : undefined,
        filePath,
      },
      { page, pageSize },
    );

    return {
      items: result.items.map((item) => ({
        id: item.id,
        type: item.debtType,
        severity: item.severity,
        confidence: item.confidence,
        title: item.title,
        filePath: item.filePath,
        startLine: item.startLine,
        endLine: item.endLine,
        status: item.status,
        createdAt: item.createdAt,
      })),
      pagination: result.pagination,
    };
  }

  @Get('scans/:scanId/debt')
  @ApiOperation({ summary: 'List debt items for a scan' })
  async listByScan(@Param('scanId') scanId: string) {
    const items = await this.debtService.findByScan(scanId);
    return items.map((item) => ({
      id: item.id,
      type: item.debtType,
      severity: item.severity,
      confidence: item.confidence,
      title: item.title,
      description: item.description,
      filePath: item.filePath,
      startLine: item.startLine,
      endLine: item.endLine,
      suggestedFix: item.suggestedFix,
      status: item.status,
    }));
  }

  @Get('debt/:id')
  @ApiOperation({ summary: 'Get debt item details' })
  async findOne(@Param('id') id: string) {
    const item = await this.debtService.findById(id);
    return {
      id: item.id,
      scanId: item.scanId,
      repositoryId: item.repositoryId,
      type: item.debtType,
      severity: item.severity,
      confidence: item.confidence,
      title: item.title,
      description: item.description,
      evidence: item.evidence,
      filePath: item.filePath,
      startLine: item.startLine,
      endLine: item.endLine,
      introducedInCommit: item.introducedInCommit,
      introducedAt: item.introducedAt,
      introducedBy: item.introducedBy,
      suggestedFix: item.suggestedFix,
      estimatedEffort: item.estimatedEffort,
      status: item.status,
      fingerprint: item.fingerprint,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  @Patch('debt/:id')
  @ApiOperation({ summary: 'Update debt item status' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateDebtStatusDto,
  ) {
    const item = await this.debtService.updateStatus(id, dto.status);
    return {
      id: item.id,
      status: item.status,
      updatedAt: item.updatedAt,
    };
  }

  @Get('repos/:repoId/debt/hotspots')
  @ApiOperation({ summary: 'Get files with most debt' })
  async getHotspots(
    @CurrentUser() user: User,
    @Param('repoId') repoId: string,
    @Query('limit') limit?: number,
  ) {
    return this.debtService.getHotspots(repoId, user.id, limit);
  }

  @Get('repos/:repoId/debt/trends')
  @ApiOperation({ summary: 'Get debt trends over time' })
  async getTrends(
    @CurrentUser() user: User,
    @Param('repoId') repoId: string,
    @Query('days') days?: number,
  ) {
    return this.debtService.getTrends(repoId, user.id, days);
  }
}
