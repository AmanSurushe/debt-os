import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EmbeddingsService } from '../embeddings/embeddings.service';

// Memory system types (inline to avoid build issues)
interface ScanResult {
  id: string;
  repositoryId: string;
  commitSha: string;
  branch: string;
  startedAt: Date;
  completedAt: Date;
  status: 'complete' | 'failed';
  findings: DebtFinding[];
  stats: ScanStats;
}

interface ScanSummary {
  id: string;
  repositoryId: string;
  commitSha: string;
  branch: string;
  completedAt: Date;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

interface ScanStats {
  filesAnalyzed: number;
  debtItemsFound: number;
  totalTokensUsed: number;
  durationMs: number;
}

interface DebtFinding {
  id: string;
  scanId: string;
  debtType: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: number;
  title: string;
  description: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
  evidence: string[];
  suggestedFix?: string;
  fingerprint: string;
}

interface DebtTrend {
  fingerprint: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  occurrenceCount: number;
  status: 'new' | 'recurring' | 'improving' | 'worsening' | 'resolved';
}

interface FileHotspot {
  filePath: string;
  totalFindings: number;
  recurringFindings: number;
  riskScore: number;
}

interface DebtVelocity {
  repositoryId: string;
  addedPerWeek: number;
  resolvedPerWeek: number;
  netChange: number;
  trend: 'improving' | 'stable' | 'worsening';
}

@Injectable()
export class MemoryService implements OnModuleInit {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private dataSource: DataSource,
    private configService: ConfigService,
    private embeddingsService: EmbeddingsService,
  ) {}

  async onModuleInit() {
    await this.ensureTables();
  }

  /**
   * Ensure memory tables exist
   */
  private async ensureTables(): Promise<void> {
    try {
      // Create scan history table
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS memory_scan_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          scan_id UUID NOT NULL,
          repository_id UUID NOT NULL,
          commit_sha VARCHAR(40) NOT NULL,
          branch VARCHAR(255) NOT NULL,
          started_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE,
          status VARCHAR(20) NOT NULL,
          findings_count INTEGER DEFAULT 0,
          critical_count INTEGER DEFAULT 0,
          high_count INTEGER DEFAULT 0,
          medium_count INTEGER DEFAULT 0,
          low_count INTEGER DEFAULT 0,
          stats JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create debt occurrences table for temporal tracking
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS memory_debt_occurrences (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          fingerprint VARCHAR(64) NOT NULL,
          scan_id UUID NOT NULL,
          repository_id UUID NOT NULL,
          file_path VARCHAR(500),
          severity VARCHAR(20) NOT NULL,
          confidence DECIMAL(3,2) NOT NULL,
          is_resolved BOOLEAN DEFAULT FALSE,
          recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create indexes
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_memory_scan_history_repo
        ON memory_scan_history(repository_id)
      `);

      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_memory_debt_occurrences_fingerprint
        ON memory_debt_occurrences(fingerprint)
      `);

      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_memory_debt_occurrences_repo
        ON memory_debt_occurrences(repository_id)
      `);

      this.logger.log('Memory tables initialized');
    } catch (error) {
      this.logger.warn('Could not create memory tables:', error);
    }
  }

  // ============ Episodic Memory Methods ============

  /**
   * Store a completed scan in memory
   */
  async storeScan(scan: ScanResult): Promise<void> {
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const finding of scan.findings) {
      if (finding.severity in severityCounts) {
        severityCounts[finding.severity as keyof typeof severityCounts]++;
      }
    }

    await this.dataSource.query(
      `INSERT INTO memory_scan_history
       (scan_id, repository_id, commit_sha, branch, started_at, completed_at,
        status, findings_count, critical_count, high_count, medium_count, low_count, stats)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        scan.id,
        scan.repositoryId,
        scan.commitSha,
        scan.branch,
        scan.startedAt,
        scan.completedAt,
        scan.status,
        scan.findings.length,
        severityCounts.critical,
        severityCounts.high,
        severityCounts.medium,
        severityCounts.low,
        JSON.stringify(scan.stats),
      ],
    );

    // Track each finding for temporal memory
    for (const finding of scan.findings) {
      await this.trackDebtOccurrence(
        finding.fingerprint,
        scan.id,
        scan.repositoryId,
        finding.filePath,
        finding.severity,
        finding.confidence,
        false,
      );
    }
  }

  /**
   * Get scan history for a repository
   */
  async getRepoHistory(repositoryId: string, limit: number = 20): Promise<ScanSummary[]> {
    const results = await this.dataSource.query(
      `SELECT scan_id as id, repository_id, commit_sha, branch, completed_at,
              findings_count, critical_count, high_count, medium_count, low_count
       FROM memory_scan_history
       WHERE repository_id = $1
       ORDER BY completed_at DESC
       LIMIT $2`,
      [repositoryId, limit],
    ) as Array<{
      id: string;
      repository_id: string;
      commit_sha: string;
      branch: string;
      completed_at: Date;
      findings_count: number;
      critical_count: number;
      high_count: number;
      medium_count: number;
      low_count: number;
    }>;

    return results.map((r) => ({
      id: r.id,
      repositoryId: r.repository_id,
      commitSha: r.commit_sha,
      branch: r.branch,
      completedAt: r.completed_at,
      findingsCount: r.findings_count,
      criticalCount: r.critical_count,
      highCount: r.high_count,
      mediumCount: r.medium_count,
      lowCount: r.low_count,
    }));
  }

  // ============ Temporal Memory Methods ============

  /**
   * Track a debt occurrence
   */
  async trackDebtOccurrence(
    fingerprint: string,
    scanId: string,
    repositoryId: string,
    filePath: string,
    severity: string,
    confidence: number,
    isResolved: boolean,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO memory_debt_occurrences
       (fingerprint, scan_id, repository_id, file_path, severity, confidence, is_resolved)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [fingerprint, scanId, repositoryId, filePath, severity, confidence, isResolved],
    );
  }

  /**
   * Get trend for a debt item
   */
  async getDebtTrend(fingerprint: string): Promise<DebtTrend | null> {
    const results = await this.dataSource.query(
      `SELECT fingerprint, MIN(recorded_at) as first_seen, MAX(recorded_at) as last_seen,
              COUNT(*) as occurrence_count,
              bool_or(is_resolved) as was_resolved
       FROM memory_debt_occurrences
       WHERE fingerprint = $1
       GROUP BY fingerprint`,
      [fingerprint],
    ) as Array<{
      fingerprint: string;
      first_seen: Date;
      last_seen: Date;
      occurrence_count: number;
      was_resolved: boolean;
    }>;

    if (results.length === 0) return null;

    const r = results[0];
    let status: DebtTrend['status'] = 'new';

    if (r.was_resolved) {
      status = 'resolved';
    } else if (r.occurrence_count > 3) {
      status = 'recurring';
    }

    return {
      fingerprint: r.fingerprint,
      firstSeenAt: r.first_seen,
      lastSeenAt: r.last_seen,
      occurrenceCount: r.occurrence_count,
      status,
    };
  }

  /**
   * Get file hotspots
   */
  async getHotspots(repositoryId: string, limit: number = 10): Promise<FileHotspot[]> {
    const results = await this.dataSource.query(
      `SELECT file_path,
              COUNT(DISTINCT fingerprint) as total_findings,
              COUNT(*) FILTER (WHERE
                fingerprint IN (
                  SELECT fingerprint FROM memory_debt_occurrences
                  WHERE repository_id = $1
                  GROUP BY fingerprint HAVING COUNT(*) > 1
                )
              ) as recurring_findings
       FROM memory_debt_occurrences
       WHERE repository_id = $1 AND file_path IS NOT NULL
       GROUP BY file_path
       ORDER BY total_findings DESC
       LIMIT $2`,
      [repositoryId, limit],
    ) as Array<{
      file_path: string;
      total_findings: number;
      recurring_findings: number;
    }>;

    return results.map((r) => ({
      filePath: r.file_path,
      totalFindings: parseInt(String(r.total_findings)),
      recurringFindings: parseInt(String(r.recurring_findings)),
      riskScore: parseInt(String(r.total_findings)) * 0.6 + parseInt(String(r.recurring_findings)) * 0.4,
    }));
  }

  /**
   * Get debt velocity metrics
   */
  async getDebtVelocity(repositoryId: string): Promise<DebtVelocity> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Count new fingerprints this week vs last week
    const thisWeekResult = await this.dataSource.query(
      `SELECT COUNT(DISTINCT fingerprint) as count
       FROM memory_debt_occurrences
       WHERE repository_id = $1 AND recorded_at >= $2`,
      [repositoryId, oneWeekAgo],
    ) as Array<{ count: number }>;

    const lastWeekResult = await this.dataSource.query(
      `SELECT COUNT(DISTINCT fingerprint) as count
       FROM memory_debt_occurrences
       WHERE repository_id = $1 AND recorded_at >= $2 AND recorded_at < $3`,
      [repositoryId, twoWeeksAgo, oneWeekAgo],
    ) as Array<{ count: number }>;

    const resolvedResult = await this.dataSource.query(
      `SELECT COUNT(DISTINCT fingerprint) as count
       FROM memory_debt_occurrences
       WHERE repository_id = $1 AND recorded_at >= $2 AND is_resolved = true`,
      [repositoryId, oneWeekAgo],
    ) as Array<{ count: number }>;

    const addedThisWeek = parseInt(String(thisWeekResult[0]?.count || 0));
    const lastWeekCount = parseInt(String(lastWeekResult[0]?.count || 0));
    const resolvedThisWeek = parseInt(String(resolvedResult[0]?.count || 0));

    const newThisWeek = Math.max(0, addedThisWeek - lastWeekCount);
    const netChange = newThisWeek - resolvedThisWeek;

    let trend: 'improving' | 'stable' | 'worsening';
    if (netChange < -2) {
      trend = 'improving';
    } else if (netChange > 2) {
      trend = 'worsening';
    } else {
      trend = 'stable';
    }

    return {
      repositoryId,
      addedPerWeek: newThisWeek,
      resolvedPerWeek: resolvedThisWeek,
      netChange,
      trend,
    };
  }

  // ============ RAG Context Methods ============

  /**
   * Build context for analysis
   */
  async buildAnalysisContext(
    repositoryId: string,
    filePath?: string,
  ): Promise<{
    previousFindings: DebtFinding[];
    hotspots: FileHotspot[];
    velocity: DebtVelocity;
  }> {
    const [hotspots, velocity] = await Promise.all([
      this.getHotspots(repositoryId, 5),
      this.getDebtVelocity(repositoryId),
    ]);

    // Get previous findings for the file if provided
    let previousFindings: DebtFinding[] = [];
    if (filePath) {
      const results = await this.dataSource.query(
        `SELECT DISTINCT ON (fingerprint)
                df.id, df.scan_id, df.debt_type, df.severity, df.confidence,
                df.title, df.description, df.file_path, df.start_line, df.end_line,
                df.evidence, df.suggested_fix
         FROM debt_findings df
         JOIN scans s ON df.scan_id = s.id
         WHERE s.repository_id = $1 AND df.file_path = $2
         ORDER BY fingerprint, df.created_at DESC
         LIMIT 10`,
        [repositoryId, filePath],
      ) as DebtFinding[];

      previousFindings = results;
    }

    return {
      previousFindings,
      hotspots,
      velocity,
    };
  }
}
