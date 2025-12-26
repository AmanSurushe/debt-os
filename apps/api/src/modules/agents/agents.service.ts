import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GitService } from '@debt-os/git';
import { Scan, ScanStats } from '../scan/entities/scan.entity';
import { Repository as RepositoryEntity } from '../repo/entities/repository.entity';
import { EmbeddingsService } from '../embeddings/embeddings.service';

// Types for agent integration (simplified to avoid import issues)
interface FileInfo {
  path: string;
  language: string | null;
  content: string;
  lineCount: number;
  sizeBytes: number;
}

interface GitContext {
  commitSha: string;
  authorName: string;
  authorEmail: string;
  date: Date;
  message: string;
}

interface RepoContext {
  id: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  languages: string[];
  fileCount: number;
  structure: Record<string, string[]>;
}

interface DebtFinding {
  id: string;
  debtType: string;
  severity: string;
  confidence: number;
  title: string;
  description: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
  evidence: string[];
  suggestedFix?: string;
}

interface RemediationPlan {
  id: string;
  scanId: string;
  summary: string;
  totalDebtItems: number;
  quickWins: unknown[];
  strategicWork: unknown[];
  deferrable: unknown[];
}

interface AgentError {
  agent: string;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

interface ScanOutput {
  findings: DebtFinding[];
  validatedFindings: DebtFinding[];
  rejectedFindings: Array<{ finding: DebtFinding; reason: string }>;
  remediationPlan: RemediationPlan | null;
  stats: {
    filesAnalyzed: number;
    findingsCount: number;
    validatedCount: number;
    rejectedCount: number;
    tasksCreated: number;
  };
  errors: AgentError[];
}

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectRepository(Scan)
    private scanRepository: Repository<Scan>,
    @InjectRepository(RepositoryEntity)
    private repositoryRepository: Repository<RepositoryEntity>,
    private dataSource: DataSource,
    private configService: ConfigService,
    private embeddingsService: EmbeddingsService,
    private gitService: GitService,
  ) {}

  /**
   * Run the full agentic analysis on a scan
   * Note: Full agent implementation requires @debt-os/agents package
   * This is a placeholder that demonstrates the integration pattern
   */
  async runAnalysis(scanId: string): Promise<ScanOutput> {
    const scan = await this.scanRepository.findOne({
      where: { id: scanId },
      relations: ['repository'],
    });

    if (!scan) {
      throw new Error(`Scan ${scanId} not found`);
    }

    const repository = scan.repository;
    if (!repository) {
      throw new Error(`Repository not found for scan ${scanId}`);
    }

    this.logger.log(`Starting agentic analysis for scan ${scanId}`);

    // Update scan status
    await this.scanRepository.update(scanId, {
      status: 'analyzing',
    });

    try {
      // Load files from the repository
      const files = await this.loadFiles(repository.id);

      // Create repo context
      const repoContext = await this.createRepoContext(repository);

      this.logger.log(`Loaded ${files.length} files for analysis`);

      // TODO: Integrate with @debt-os/agents package when built
      // For now, return empty results to complete the integration pattern
      const result: ScanOutput = {
        findings: [],
        validatedFindings: [],
        rejectedFindings: [],
        remediationPlan: null,
        stats: {
          filesAnalyzed: files.length,
          findingsCount: 0,
          validatedCount: 0,
          rejectedCount: 0,
          tasksCreated: 0,
        },
        errors: [],
      };

      // Store results
      await this.storeResults(scanId, result);

      // Update scan status and stats
      const scanStats: ScanStats = {
        filesAnalyzed: result.stats.filesAnalyzed,
        debtItemsFound: result.stats.findingsCount,
        totalTokensUsed: 0,
        totalCost: 0,
        durationMs: 0,
      };

      await this.scanRepository.update(scanId, {
        status: 'complete',
        completedAt: new Date(),
        stats: scanStats,
      });

      this.logger.log(
        `Completed analysis for scan ${scanId}: ${result.stats.findingsCount} findings, ` +
          `${result.stats.validatedCount} validated, ${result.stats.tasksCreated} tasks`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Analysis failed for scan ${scanId}:`, error);

      await this.scanRepository.update(scanId, {
        status: 'failed',
        completedAt: new Date(),
      });

      throw error;
    }
  }

  /**
   * Load files from the repository for analysis
   */
  private async loadFiles(repositoryId: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const fileList = await this.gitService.listFiles(repositoryId);

    // Filter and load files
    const ignoredPatterns = [
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /coverage/,
      /\.next/,
      /\.nuxt/,
      /vendor/,
      /\.min\.(js|css)$/,
      /\.map$/,
      /package-lock\.json$/,
      /yarn\.lock$/,
      /pnpm-lock\.yaml$/,
    ];

    const codeExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java',
      '.rb', '.php', '.cs', '.cpp', '.c', '.h', '.swift', '.kt',
    ];

    for (const file of fileList) {
      // Skip ignored files
      if (ignoredPatterns.some((p) => p.test(file.path))) {
        continue;
      }

      // Only process code files
      const ext = file.path.substring(file.path.lastIndexOf('.'));
      if (!codeExtensions.includes(ext)) {
        continue;
      }

      try {
        const content = await this.gitService.getFileContent(repositoryId, file.path);

        // Skip very large files
        if (content.length > 100000) {
          continue;
        }

        const lines = content.split('\n');
        const language = this.detectLanguage(ext);

        files.push({
          path: file.path,
          language,
          content,
          lineCount: lines.length,
          sizeBytes: Buffer.byteLength(content, 'utf8'),
        });
      } catch {
        // Skip files that can't be read
      }
    }

    return files;
  }

  /**
   * Create repository context for agents
   */
  private async createRepoContext(repository: RepositoryEntity): Promise<RepoContext> {
    const fileList = await this.gitService.listFiles(repository.id);
    const defaultBranch = await this.gitService.getDefaultBranch(repository.id);

    // Build directory structure
    const structure: Record<string, string[]> = {};
    for (const file of fileList) {
      const dir = file.path.substring(0, file.path.lastIndexOf('/')) || '/';
      if (!structure[dir]) {
        structure[dir] = [];
      }
      structure[dir].push(file.path);
    }

    // Detect languages
    const extensions = new Set<string>();
    for (const file of fileList) {
      const ext = file.path.substring(file.path.lastIndexOf('.'));
      extensions.add(ext);
    }

    const languages = Array.from(extensions)
      .map((ext) => this.detectLanguage(ext))
      .filter((lang): lang is string => lang !== null);

    return {
      id: repository.id,
      name: repository.name,
      fullName: repository.fullName,
      defaultBranch,
      languages: [...new Set(languages)],
      fileCount: fileList.length,
      structure,
    };
  }

  /**
   * Store analysis results in the database
   */
  private async storeResults(scanId: string, result: ScanOutput): Promise<void> {
    // Store findings
    for (const finding of result.validatedFindings) {
      await this.dataSource.query(
        `INSERT INTO debt_findings
         (id, scan_id, debt_type, severity, confidence, title, description,
          file_path, start_line, end_line, evidence, suggested_fix)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           confidence = $5, title = $6, description = $7`,
        [
          finding.id,
          scanId,
          finding.debtType,
          finding.severity,
          finding.confidence,
          finding.title,
          finding.description,
          finding.filePath,
          finding.startLine,
          finding.endLine,
          JSON.stringify(finding.evidence),
          finding.suggestedFix,
        ],
      );
    }

    // Store remediation plan
    if (result.remediationPlan) {
      await this.dataSource.query(
        `INSERT INTO remediation_plans
         (id, scan_id, summary, total_debt_items, quick_wins, strategic_work, deferrable)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           summary = $3, quick_wins = $5`,
        [
          result.remediationPlan.id,
          scanId,
          result.remediationPlan.summary,
          result.remediationPlan.totalDebtItems,
          JSON.stringify(result.remediationPlan.quickWins),
          JSON.stringify(result.remediationPlan.strategicWork),
          JSON.stringify(result.remediationPlan.deferrable),
        ],
      );
    }
  }

  /**
   * Detect language from file extension
   */
  private detectLanguage(extension: string): string | null {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.rb': 'ruby',
      '.php': 'php',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.swift': 'swift',
      '.kt': 'kotlin',
    };

    return languageMap[extension] || null;
  }
}
