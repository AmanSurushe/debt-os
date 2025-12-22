import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RepoService } from './repo.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { ConnectRepoDto } from './dto/connect-repo.dto';
import { UpdateRepoSettingsDto } from './dto/update-repo-settings.dto';

@ApiTags('repos')
@Controller('repos')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class RepoController {
  constructor(private repoService: RepoService) {}

  @Post()
  @ApiOperation({ summary: 'Connect a repository' })
  async connect(@CurrentUser() user: User, @Body() dto: ConnectRepoDto) {
    const repo = await this.repoService.connect(user.id, dto);
    return {
      id: repo.id,
      provider: repo.provider,
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      status: 'connected',
      createdAt: repo.createdAt,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List connected repositories' })
  async list(@CurrentUser() user: User) {
    const repos = await this.repoService.findAll(user.id);
    return repos.map((repo) => ({
      id: repo.id,
      provider: repo.provider,
      fullName: repo.fullName,
      defaultBranch: repo.defaultBranch,
      lastSyncedAt: repo.lastSyncedAt,
      settings: repo.settings,
      createdAt: repo.createdAt,
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get repository details' })
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    const repo = await this.repoService.findById(id, user.id);
    return {
      id: repo.id,
      provider: repo.provider,
      fullName: repo.fullName,
      ownerName: repo.ownerName,
      name: repo.name,
      defaultBranch: repo.defaultBranch,
      cloneUrl: repo.cloneUrl,
      lastSyncedAt: repo.lastSyncedAt,
      settings: repo.settings,
      webhookInstalled: !!repo.webhookId,
      createdAt: repo.createdAt,
      updatedAt: repo.updatedAt,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update repository settings' })
  async updateSettings(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateRepoSettingsDto,
  ) {
    const repo = await this.repoService.updateSettings(id, user.id, dto);
    return {
      id: repo.id,
      settings: repo.settings,
      updatedAt: repo.updatedAt,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect repository' })
  async disconnect(@CurrentUser() user: User, @Param('id') id: string) {
    await this.repoService.disconnect(id, user.id);
  }

  @Post(':id/sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger manual sync' })
  async sync(@CurrentUser() user: User, @Param('id') id: string) {
    await this.repoService.triggerSync(id, user.id);
    return { message: 'Sync queued' };
  }
}
