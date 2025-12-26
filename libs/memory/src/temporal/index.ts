import { v4 as uuidv4 } from 'uuid';
import {
  TemporalMemory,
  DebtStatus,
  DebtTrend,
  TrendDataPoint,
  TrendPeriod,
  RepoTrend,
  RepoTrendDataPoint,
  DebtVelocity,
  FileHotspot,
  MemoryStorage,
} from '../types';

export interface TemporalMemoryConfig {
  storage: MemoryStorage;
}

interface DebtOccurrence {
  id: string;
  fingerprint: string;
  scanId: string;
  repositoryId: string;
  severity: string;
  confidence: number;
  isResolved: boolean;
  filePath: string;
  recordedAt: Date;
}

export class TemporalMemoryImpl implements TemporalMemory {
  private storage: MemoryStorage;

  constructor(config: TemporalMemoryConfig) {
    this.storage = config.storage;
  }

  /**
   * Track a debt item occurrence in a scan
   */
  async trackDebtItem(
    fingerprint: string,
    scanId: string,
    status: DebtStatus,
  ): Promise<void> {
    const occurrence: DebtOccurrence = {
      id: uuidv4(),
      fingerprint,
      scanId,
      repositoryId: '', // Will be enriched by caller
      severity: status.severity,
      confidence: status.confidence,
      isResolved: status.isResolved,
      filePath: '', // Will be enriched by caller
      recordedAt: new Date(),
    };

    await this.storage.store('debt_occurrences', occurrence);
  }

  /**
   * Track debt item with full context
   */
  async trackDebtItemFull(
    fingerprint: string,
    scanId: string,
    repositoryId: string,
    filePath: string,
    status: DebtStatus,
  ): Promise<void> {
    const occurrence: DebtOccurrence = {
      id: uuidv4(),
      fingerprint,
      scanId,
      repositoryId,
      severity: status.severity,
      confidence: status.confidence,
      isResolved: status.isResolved,
      filePath,
      recordedAt: new Date(),
    };

    await this.storage.store('debt_occurrences', occurrence);
  }

  /**
   * Get trend data for a specific debt item
   */
  async getDebtTrend(fingerprint: string): Promise<DebtTrend> {
    const occurrences = await this.storage.query<DebtOccurrence>(
      'debt_occurrences',
      {
        field: 'fingerprint',
        operator: 'eq',
        value: fingerprint,
      },
    );

    if (occurrences.length === 0) {
      return {
        fingerprint,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        occurrences: [],
        status: 'new',
      };
    }

    // Sort by date
    const sorted = occurrences.sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );

    const dataPoints: TrendDataPoint[] = sorted.map((o) => ({
      scanId: o.scanId,
      date: o.recordedAt,
      severity: o.severity,
      confidence: o.confidence,
      wasPresent: !o.isResolved,
    }));

    // Determine trend status
    const lastOccurrence = sorted[sorted.length - 1];
    const status = this.determineTrendStatus(sorted);

    // Calculate average time to resolve if applicable
    let averageTimeToResolve: number | undefined;
    const resolvedOccurrences = sorted.filter((o) => o.isResolved);
    if (resolvedOccurrences.length > 0) {
      const resolutionTimes = resolvedOccurrences.map((o, i) => {
        const previousUnresolved = sorted
          .slice(0, sorted.indexOf(o))
          .filter((p) => !p.isResolved)
          .pop();
        if (previousUnresolved) {
          return new Date(o.recordedAt).getTime() - new Date(previousUnresolved.recordedAt).getTime();
        }
        return 0;
      }).filter((t) => t > 0);

      if (resolutionTimes.length > 0) {
        averageTimeToResolve = resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length;
      }
    }

    return {
      fingerprint,
      firstSeenAt: sorted[0].recordedAt,
      lastSeenAt: lastOccurrence.recordedAt,
      occurrences: dataPoints,
      status,
      averageTimeToResolve,
    };
  }

  /**
   * Get trend data for a repository
   */
  async getRepoTrend(repositoryId: string, period: TrendPeriod): Promise<RepoTrend> {
    const periodMs = this.getPeriodMs(period);
    const startDate = new Date(Date.now() - periodMs);

    const occurrences = await this.storage.query<DebtOccurrence>(
      'debt_occurrences',
      {
        field: 'repositoryId',
        operator: 'eq',
        value: repositoryId,
      },
    );

    // Filter to period
    const periodOccurrences = occurrences.filter(
      (o) => new Date(o.recordedAt) >= startDate,
    );

    // Group by day
    const dailyData = this.groupByDay(periodOccurrences);

    // Build data points
    const dataPoints: RepoTrendDataPoint[] = Object.entries(dailyData)
      .map(([dateStr, dayOccurrences]) => {
        const byFingerprint = new Map<string, DebtOccurrence>();
        for (const o of dayOccurrences) {
          byFingerprint.set(o.fingerprint, o);
        }

        const uniqueItems = Array.from(byFingerprint.values());

        return {
          date: new Date(dateStr),
          totalDebt: uniqueItems.filter((o) => !o.isResolved).length,
          criticalCount: uniqueItems.filter((o) => o.severity === 'critical' && !o.isResolved).length,
          highCount: uniqueItems.filter((o) => o.severity === 'high' && !o.isResolved).length,
          mediumCount: uniqueItems.filter((o) => o.severity === 'medium' && !o.isResolved).length,
          lowCount: uniqueItems.filter((o) => o.severity === 'low' && !o.isResolved).length,
          resolvedCount: uniqueItems.filter((o) => o.isResolved).length,
          newCount: 0, // Would need comparison with previous day
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate new counts by comparing consecutive days
    for (let i = 1; i < dataPoints.length; i++) {
      const diff = dataPoints[i].totalDebt - dataPoints[i - 1].totalDebt;
      dataPoints[i].newCount = Math.max(0, diff);
    }

    // Calculate summary
    const firstPoint = dataPoints[0];
    const lastPoint = dataPoints[dataPoints.length - 1];

    const summary = {
      totalDebtChange: lastPoint ? lastPoint.totalDebt - (firstPoint?.totalDebt || 0) : 0,
      criticalChange: lastPoint ? lastPoint.criticalCount - (firstPoint?.criticalCount || 0) : 0,
      averageResolutionTime: 0,
      topNewDebtTypes: this.getTopDebtTypes(periodOccurrences),
    };

    return {
      repositoryId,
      period,
      dataPoints,
      summary,
    };
  }

  /**
   * Get debt velocity metrics
   */
  async getDebtVelocity(repositoryId: string): Promise<DebtVelocity> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const occurrences = await this.storage.query<DebtOccurrence>(
      'debt_occurrences',
      {
        field: 'repositoryId',
        operator: 'eq',
        value: repositoryId,
      },
    );

    const lastWeek = occurrences.filter(
      (o) => new Date(o.recordedAt) >= oneWeekAgo,
    );
    const previousWeek = occurrences.filter(
      (o) => new Date(o.recordedAt) >= twoWeeksAgo && new Date(o.recordedAt) < oneWeekAgo,
    );

    // Count unique new items (by fingerprint) this week
    const thisWeekFingerprints = new Set(lastWeek.map((o) => o.fingerprint));
    const previousWeekFingerprints = new Set(previousWeek.map((o) => o.fingerprint));

    const addedThisWeek = [...thisWeekFingerprints].filter(
      (fp) => !previousWeekFingerprints.has(fp),
    ).length;

    const resolvedThisWeek = lastWeek.filter((o) => o.isResolved).length;

    const netChange = addedThisWeek - resolvedThisWeek;
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
      addedPerWeek: addedThisWeek,
      resolvedPerWeek: resolvedThisWeek,
      netChange,
      trend,
    };
  }

  /**
   * Get file hotspots - files with most recurring issues
   */
  async getHotspots(repositoryId: string, limit?: number): Promise<FileHotspot[]> {
    const effectiveLimit = limit || 10;

    const occurrences = await this.storage.query<DebtOccurrence>(
      'debt_occurrences',
      {
        field: 'repositoryId',
        operator: 'eq',
        value: repositoryId,
      },
    );

    // Group by file
    const fileStats = new Map<string, {
      totalFindings: number;
      fingerprints: Set<string>;
      occurrenceCount: number;
      lastSeen: Date;
    }>();

    for (const o of occurrences) {
      if (!o.filePath) continue;

      const stats = fileStats.get(o.filePath) || {
        totalFindings: 0,
        fingerprints: new Set<string>(),
        occurrenceCount: 0,
        lastSeen: new Date(0),
      };

      stats.fingerprints.add(o.fingerprint);
      stats.occurrenceCount++;
      if (new Date(o.recordedAt) > stats.lastSeen) {
        stats.lastSeen = new Date(o.recordedAt);
      }

      fileStats.set(o.filePath, stats);
    }

    // Calculate hotspots
    const hotspots: FileHotspot[] = [];

    for (const [filePath, stats] of fileStats) {
      // Recurring = fingerprints that appear in multiple scans
      const fingerprintOccurrences = new Map<string, number>();
      for (const o of occurrences.filter((x) => x.filePath === filePath)) {
        fingerprintOccurrences.set(
          o.fingerprint,
          (fingerprintOccurrences.get(o.fingerprint) || 0) + 1,
        );
      }
      const recurringFindings = [...fingerprintOccurrences.values()].filter((c) => c > 1).length;

      // Simple churn score based on occurrence frequency
      const churnScore = stats.occurrenceCount / stats.fingerprints.size;

      // Risk score combines recurrence and total findings
      const riskScore = (stats.fingerprints.size * 0.6) + (recurringFindings * 0.4);

      hotspots.push({
        filePath,
        totalFindings: stats.fingerprints.size,
        recurringFindings,
        lastModified: stats.lastSeen,
        churnScore,
        riskScore,
      });
    }

    // Sort by risk score and limit
    return hotspots
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, effectiveLimit);
  }

  /**
   * Determine the trend status for a debt item
   */
  private determineTrendStatus(
    occurrences: DebtOccurrence[],
  ): 'new' | 'recurring' | 'improving' | 'worsening' | 'resolved' {
    if (occurrences.length === 0) return 'new';
    if (occurrences.length === 1) return 'new';

    const lastFew = occurrences.slice(-3);
    const lastOne = lastFew[lastFew.length - 1];

    // Check if resolved
    if (lastOne.isResolved) return 'resolved';

    // Check trend in severity/confidence
    if (lastFew.length >= 2) {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
      const firstSeverity = severityOrder[lastFew[0].severity as keyof typeof severityOrder] || 0;
      const lastSeverity = severityOrder[lastOne.severity as keyof typeof severityOrder] || 0;

      if (lastSeverity > firstSeverity) return 'worsening';
      if (lastSeverity < firstSeverity) return 'improving';
    }

    return 'recurring';
  }

  /**
   * Get period in milliseconds
   */
  private getPeriodMs(period: TrendPeriod): number {
    const periods: Record<TrendPeriod, number> = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000,
    };
    return periods[period];
  }

  /**
   * Group occurrences by day
   */
  private groupByDay(occurrences: DebtOccurrence[]): Record<string, DebtOccurrence[]> {
    const groups: Record<string, DebtOccurrence[]> = {};

    for (const o of occurrences) {
      const dateStr = new Date(o.recordedAt).toISOString().split('T')[0];
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(o);
    }

    return groups;
  }

  /**
   * Get top debt types from occurrences
   */
  private getTopDebtTypes(occurrences: DebtOccurrence[]): string[] {
    const typeCounts = new Map<string, number>();

    for (const o of occurrences) {
      // Note: debt type would need to be stored in occurrence
      // For now, using severity as a proxy
      typeCounts.set(o.severity, (typeCounts.get(o.severity) || 0) + 1);
    }

    return [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type]) => type);
  }
}

export function createTemporalMemory(config: TemporalMemoryConfig): TemporalMemory {
  return new TemporalMemoryImpl(config);
}
