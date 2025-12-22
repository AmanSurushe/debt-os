import {
  Controller,
  Post,
  Headers,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private webhookService: WebhookService) {}

  @Post('github')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'GitHub webhook receiver' })
  @ApiHeader({ name: 'X-GitHub-Event', required: true })
  @ApiHeader({ name: 'X-Hub-Signature-256', required: false })
  async handleGitHub(
    @Headers('X-GitHub-Event') event: string,
    @Headers('X-Hub-Signature-256') signature: string,
    @Body() payload: any,
  ) {
    this.logger.log(`Received GitHub webhook: ${event}`);

    await this.webhookService.handleGitHubWebhook(event, signature, payload);

    return { received: true };
  }

  @Post('gitlab')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'GitLab webhook receiver' })
  @ApiHeader({ name: 'X-Gitlab-Token', required: true })
  async handleGitLab(
    @Headers('X-Gitlab-Token') token: string,
    @Body() payload: any,
  ) {
    this.logger.log('Received GitLab webhook');

    await this.webhookService.handleGitLabWebhook(token, payload);

    return { received: true };
  }
}
