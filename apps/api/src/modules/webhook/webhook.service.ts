import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as TypeOrmRepository } from 'typeorm';
import * as crypto from 'crypto';
import { Repository } from '../repo/entities/repository.entity';
import { ScanService } from '../scan/scan.service';

interface GitHubPushEvent {
  ref: string;
  after: string;
  repository: {
    id: number;
    full_name: string;
  };
}

interface GitHubPullRequestEvent {
  action: string;
  pull_request: {
    head: {
      sha: string;
      ref: string;
    };
  };
  repository: {
    id: number;
    full_name: string;
  };
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Repository)
    private repoRepository: TypeOrmRepository<Repository>,
    private scanService: ScanService,
  ) {}

  async handleGitHubWebhook(
    event: string,
    signature: string,
    payload: any,
  ): Promise<void> {
    const repoFullName = payload.repository?.full_name;

    if (!repoFullName) {
      this.logger.warn('Webhook received without repository info');
      return;
    }

    // Find repository
    const repo = await this.repoRepository.findOne({
      where: { fullName: repoFullName, provider: 'github' },
    });

    if (!repo) {
      this.logger.warn(`Repository not found: ${repoFullName}`);
      return;
    }

    // Verify signature
    if (repo.webhookSecret) {
      const isValid = this.verifyGitHubSignature(
        signature,
        repo.webhookSecret,
        JSON.stringify(payload),
      );

      if (!isValid) {
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    // Handle different events
    switch (event) {
      case 'push':
        await this.handlePushEvent(repo, payload as GitHubPushEvent);
        break;
      case 'pull_request':
        await this.handlePullRequestEvent(repo, payload as GitHubPullRequestEvent);
        break;
      default:
        this.logger.log(`Ignoring event type: ${event}`);
    }
  }

  private async handlePushEvent(
    repo: Repository,
    payload: GitHubPushEvent,
  ): Promise<void> {
    if (!repo.settings.scanOnPush) {
      this.logger.log(`Push scanning disabled for ${repo.fullName}`);
      return;
    }

    // Extract branch name from ref (refs/heads/main -> main)
    const branch = payload.ref.replace('refs/heads/', '');

    // Only scan default branch by default
    if (branch !== repo.defaultBranch) {
      this.logger.log(`Skipping non-default branch push: ${branch}`);
      return;
    }

    this.logger.log(`Triggering scan for push to ${repo.fullName}@${branch}`);

    await this.scanService.createFromWebhook(
      repo.id,
      payload.after,
      branch,
      'webhook',
    );
  }

  private async handlePullRequestEvent(
    repo: Repository,
    payload: GitHubPullRequestEvent,
  ): Promise<void> {
    if (!repo.settings.scanOnPr) {
      this.logger.log(`PR scanning disabled for ${repo.fullName}`);
      return;
    }

    // Only scan on opened or synchronized
    if (!['opened', 'synchronize'].includes(payload.action)) {
      return;
    }

    const { sha, ref: branch } = payload.pull_request.head;

    this.logger.log(`Triggering scan for PR on ${repo.fullName}@${branch}`);

    await this.scanService.createFromWebhook(repo.id, sha, branch, 'webhook');
  }

  private verifyGitHubSignature(
    signature: string,
    secret: string,
    payload: string,
  ): boolean {
    if (!signature) {
      return false;
    }

    const sig = signature.replace('sha256=', '');
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
  }

  async handleGitLabWebhook(
    token: string,
    payload: any,
  ): Promise<void> {
    // GitLab webhook implementation
    // TODO: Implement GitLab webhook handling
    this.logger.log('GitLab webhook received');
  }
}
