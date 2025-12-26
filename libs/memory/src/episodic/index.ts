import { v4 as uuidv4 } from 'uuid';
import {
  EpisodicMemory,
  ScanResult,
  ScanSummary,
  UserFeedback,
  DebtPattern,
  DebtFinding,
  MemoryStorage,
} from '../types';

export interface EpisodicMemoryConfig {
  storage: MemoryStorage;
  maxHistoryPerRepo?: number;
}

export class EpisodicMemoryImpl implements EpisodicMemory {
  private storage: MemoryStorage;
  private maxHistoryPerRepo: number;

  constructor(config: EpisodicMemoryConfig) {
    this.storage = config.storage;
    this.maxHistoryPerRepo = config.maxHistoryPerRepo || 100;
  }

  /**
   * Store a completed scan result
   */
  async storeScan(scan: ScanResult): Promise<void> {
    // Store the full scan result
    await this.storage.store('scans', {
      ...scan,
      storedAt: new Date(),
    });

    // Store each finding for quick lookup
    for (const finding of scan.findings) {
      await this.storage.store('findings', {
        ...finding,
        repositoryId: scan.repositoryId,
      });
    }

    // Create and store scan summary for quick retrieval
    const summary = this.createScanSummary(scan);
    await this.storage.store('scan_summaries', summary);
  }

  /**
   * Get scan history for a repository
   */
  async getRepoHistory(repoId: string, limit?: number): Promise<ScanSummary[]> {
    const effectiveLimit = Math.min(limit || 20, this.maxHistoryPerRepo);

    const summaries = await this.storage.query<ScanSummary & { completedAt: Date }>(
      'scan_summaries',
      {
        field: 'repositoryId',
        operator: 'eq',
        value: repoId,
      },
    );

    // Sort by completion date descending and limit
    return summaries
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, effectiveLimit);
  }

  /**
   * Store user feedback on a finding
   */
  async storeFeedback(feedback: UserFeedback): Promise<void> {
    const feedbackWithId = {
      ...feedback,
      id: feedback.id || uuidv4(),
      createdAt: feedback.createdAt || new Date(),
    };

    await this.storage.store('feedback', feedbackWithId);

    // Update the finding with feedback flag
    const finding = await this.storage.get<DebtFinding>('findings', feedback.findingId);
    if (finding) {
      await this.storage.update('findings', feedback.findingId, {
        hasFeedback: true,
        lastFeedbackType: feedback.feedbackType,
      });
    }
  }

  /**
   * Get feedback for findings matching a pattern
   */
  async getFeedbackForPattern(pattern: DebtPattern): Promise<UserFeedback[]> {
    // Get all findings of this debt type
    const findings = await this.storage.query<DebtFinding & { hasFeedback?: boolean }>(
      'findings',
      {
        field: 'debtType',
        operator: 'eq',
        value: pattern.debtType,
      },
    );

    // Get feedback for findings that have it
    const findingsWithFeedback = findings.filter((f) => f.hasFeedback);
    const feedbackPromises = findingsWithFeedback.map((f) =>
      this.storage.query<UserFeedback>('feedback', {
        field: 'findingId',
        operator: 'eq',
        value: f.id,
      }),
    );

    const feedbackArrays = await Promise.all(feedbackPromises);
    return feedbackArrays.flat();
  }

  /**
   * Get recent scans across all repositories
   */
  async getRecentScans(limit?: number): Promise<ScanSummary[]> {
    const effectiveLimit = limit || 20;

    // This would need optimization in production with proper indexing
    const allSummaries = await this.storage.query<ScanSummary & { completedAt: Date }>(
      'scan_summaries',
      {
        field: 'completedAt',
        operator: 'gt',
        value: new Date(0), // Get all
      },
    );

    return allSummaries
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
      .slice(0, effectiveLimit);
  }

  /**
   * Get a specific scan by ID
   */
  async getScanById(scanId: string): Promise<ScanResult | null> {
    return this.storage.get<ScanResult>('scans', scanId);
  }

  /**
   * Get findings for a specific scan
   */
  async getFindingsForScan(scanId: string): Promise<DebtFinding[]> {
    return this.storage.query<DebtFinding>('findings', {
      field: 'scanId',
      operator: 'eq',
      value: scanId,
    });
  }

  /**
   * Get similar findings from history (for deduplication)
   */
  async getSimilarFindings(fingerprint: string): Promise<DebtFinding[]> {
    return this.storage.query<DebtFinding>('findings', {
      field: 'fingerprint',
      operator: 'eq',
      value: fingerprint,
    });
  }

  /**
   * Get finding history for a file
   */
  async getFileHistory(
    repositoryId: string,
    filePath: string,
  ): Promise<DebtFinding[]> {
    const allFindings = await this.storage.query<DebtFinding & { repositoryId: string }>(
      'findings',
      {
        field: 'repositoryId',
        operator: 'eq',
        value: repositoryId,
      },
    );

    return allFindings.filter((f) => f.filePath === filePath);
  }

  /**
   * Create a scan summary from full scan result
   */
  private createScanSummary(scan: ScanResult): ScanSummary {
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const finding of scan.findings) {
      if (finding.severity in severityCounts) {
        severityCounts[finding.severity as keyof typeof severityCounts]++;
      }
    }

    return {
      id: scan.id,
      repositoryId: scan.repositoryId,
      commitSha: scan.commitSha,
      branch: scan.branch,
      completedAt: scan.completedAt,
      findingsCount: scan.findings.length,
      criticalCount: severityCounts.critical,
      highCount: severityCounts.high,
      mediumCount: severityCounts.medium,
      lowCount: severityCounts.low,
    };
  }
}

export function createEpisodicMemory(config: EpisodicMemoryConfig): EpisodicMemory {
  return new EpisodicMemoryImpl(config);
}
