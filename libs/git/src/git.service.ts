import simpleGit, { SimpleGit, CloneOptions as SimpleGitCloneOptions } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import { GitConfig, CloneOptions, PullOptions, CommitInfo, FileInfo, BlameInfo } from './types';

export class GitService {
  private basePath: string;

  constructor(config: GitConfig) {
    this.basePath = config.basePath;

    // Ensure base path exists
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  /**
   * Get the local path for a repository
   */
  getRepoPath(repoId: string): string {
    return path.join(this.basePath, repoId);
  }

  /**
   * Check if a repository exists locally
   */
  exists(repoId: string): boolean {
    const repoPath = this.getRepoPath(repoId);
    return fs.existsSync(path.join(repoPath, '.git'));
  }

  /**
   * Clone a repository
   */
  async clone(repoId: string, options: CloneOptions): Promise<void> {
    const repoPath = this.getRepoPath(repoId);

    // Clean up if exists
    if (fs.existsSync(repoPath)) {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }

    // Build clone URL with token if provided
    let cloneUrl = options.url;
    if (options.token) {
      const url = new URL(options.url);
      url.username = options.token;
      url.password = 'x-oauth-basic';
      cloneUrl = url.toString();
    }

    const git = simpleGit();

    const cloneOptions: SimpleGitCloneOptions = {};

    if (options.branch) {
      cloneOptions['--branch'] = options.branch;
    }

    if (options.depth) {
      cloneOptions['--depth'] = options.depth;
    }

    await git.clone(cloneUrl, repoPath, cloneOptions);
  }

  /**
   * Pull latest changes
   */
  async pull(repoId: string, options: PullOptions = {}): Promise<void> {
    const repoPath = this.getRepoPath(repoId);

    if (!this.exists(repoId)) {
      throw new Error(`Repository ${repoId} does not exist locally`);
    }

    const git = simpleGit(repoPath);

    if (options.branch) {
      await git.checkout(options.branch);
    }

    await git.pull();
  }

  /**
   * Get current HEAD commit SHA
   */
  async getHead(repoId: string): Promise<string> {
    const git = this.getGit(repoId);
    const result = await git.revparse(['HEAD']);
    return result.trim();
  }

  /**
   * Get commit log
   */
  async getLog(
    repoId: string,
    options: { file?: string; limit?: number } = {},
  ): Promise<CommitInfo[]> {
    const git = this.getGit(repoId);

    const logOptions: any = {
      maxCount: options.limit || 20,
    };

    if (options.file) {
      logOptions.file = options.file;
    }

    const log = await git.log(logOptions);

    return log.all.map((commit) => ({
      sha: commit.hash,
      message: commit.message,
      authorName: commit.author_name,
      authorEmail: commit.author_email,
      date: new Date(commit.date),
    }));
  }

  /**
   * Get diff for a commit
   */
  async getDiff(repoId: string, commitSha: string): Promise<string> {
    const git = this.getGit(repoId);
    return git.diff([`${commitSha}^`, commitSha]);
  }

  /**
   * Get file content at a specific commit
   */
  async getFileContent(
    repoId: string,
    filePath: string,
    commitSha?: string,
  ): Promise<string> {
    const git = this.getGit(repoId);
    const ref = commitSha || 'HEAD';
    return git.show([`${ref}:${filePath}`]);
  }

  /**
   * List all files in the repository
   */
  async listFiles(repoId: string, directory: string = ''): Promise<FileInfo[]> {
    const git = this.getGit(repoId);
    const repoPath = this.getRepoPath(repoId);

    const result = await git.raw(['ls-tree', '-r', '--name-only', 'HEAD', directory || '.']);

    return result
      .split('\n')
      .filter(Boolean)
      .map((filePath) => ({
        path: filePath,
        type: 'file' as const,
      }));
  }

  /**
   * Get blame information for a file
   */
  async getBlame(
    repoId: string,
    filePath: string,
    startLine?: number,
    endLine?: number,
  ): Promise<BlameInfo[]> {
    const git = this.getGit(repoId);

    const args = ['blame', '--porcelain'];

    if (startLine && endLine) {
      args.push(`-L${startLine},${endLine}`);
    }

    args.push(filePath);

    const result = await git.raw(args);

    return this.parseBlameOutput(result);
  }

  /**
   * Check if file exists in repository
   */
  async fileExists(repoId: string, filePath: string): Promise<boolean> {
    try {
      await this.getFileContent(repoId, filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the default branch
   */
  async getDefaultBranch(repoId: string): Promise<string> {
    const git = this.getGit(repoId);

    try {
      // Try to get from remote
      const result = await git.raw(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      return result.trim().replace('refs/remotes/origin/', '');
    } catch {
      // Fall back to common defaults
      const branches = await git.branchLocal();
      if (branches.all.includes('main')) return 'main';
      if (branches.all.includes('master')) return 'master';
      return branches.current;
    }
  }

  /**
   * Clean up a repository
   */
  async remove(repoId: string): Promise<void> {
    const repoPath = this.getRepoPath(repoId);

    if (fs.existsSync(repoPath)) {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
  }

  private getGit(repoId: string): SimpleGit {
    const repoPath = this.getRepoPath(repoId);

    if (!this.exists(repoId)) {
      throw new Error(`Repository ${repoId} does not exist locally`);
    }

    return simpleGit(repoPath);
  }

  private parseBlameOutput(output: string): BlameInfo[] {
    const lines = output.split('\n');
    const results: BlameInfo[] = [];

    let currentCommit: Partial<BlameInfo> = {};
    let lineNumber = 0;

    for (const line of lines) {
      if (line.match(/^[0-9a-f]{40}/)) {
        const parts = line.split(' ');
        currentCommit.commitSha = parts[0];
        lineNumber = parseInt(parts[2], 10);
      } else if (line.startsWith('author ')) {
        currentCommit.authorName = line.substring(7);
      } else if (line.startsWith('author-mail ')) {
        currentCommit.authorEmail = line.substring(12).replace(/[<>]/g, '');
      } else if (line.startsWith('author-time ')) {
        currentCommit.date = new Date(parseInt(line.substring(12), 10) * 1000);
      } else if (line.startsWith('\t')) {
        currentCommit.content = line.substring(1);
        currentCommit.lineNumber = lineNumber;

        if (currentCommit.commitSha) {
          results.push(currentCommit as BlameInfo);
        }

        currentCommit = {};
      }
    }

    return results;
  }
}
