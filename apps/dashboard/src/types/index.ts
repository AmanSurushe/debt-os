// User types
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  provider: 'github' | 'gitlab';
}

// Repository types
export interface Repository {
  id: string;
  externalId: string;
  provider: 'github' | 'gitlab';
  ownerName: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  cloneUrl: string;
  lastSyncedAt: string | null;
  settings: RepositorySettings;
  webhookInstalled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RepositorySettings {
  autoScan: boolean;
  scanOnPush: boolean;
  scanOnPr: boolean;
  excludePaths: string[];
  includePaths: string[];
}

// Scan types
export type ScanStatus = 'pending' | 'ingesting' | 'analyzing' | 'complete' | 'failed';
export type ScanTrigger = 'manual' | 'webhook' | 'schedule';

export interface Scan {
  id: string;
  repositoryId: string;
  commitSha: string;
  branch: string;
  status: ScanStatus;
  triggeredBy: ScanTrigger;
  triggeredById: string | null;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  stats: ScanStats | null;
  createdAt: string;
}

export interface ScanStats {
  filesAnalyzed: number;
  debtItemsFound: number;
  totalTokensUsed: number;
  totalCost: number;
  durationMs: number;
}

// Debt types
export type DebtType =
  | 'CODE_SMELL'
  | 'COMPLEXITY'
  | 'DUPLICATION'
  | 'DEAD_CODE'
  | 'CIRCULAR_DEPENDENCY'
  | 'LAYER_VIOLATION'
  | 'GOD_CLASS'
  | 'FEATURE_ENVY'
  | 'OUTDATED_DEPENDENCY'
  | 'VULNERABLE_DEPENDENCY'
  | 'MISSING_LOCK_FILE'
  | 'LOW_COVERAGE'
  | 'MISSING_TESTS'
  | 'FLAKY_TESTS'
  | 'MISSING_DOCS'
  | 'OUTDATED_DOCS'
  | 'HARDCODED_CONFIG'
  | 'SECURITY_ISSUE';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type DebtStatus = 'open' | 'acknowledged' | 'planned' | 'in_progress' | 'resolved' | 'wont_fix';
export type EffortEstimate = 'trivial' | 'small' | 'medium' | 'large' | 'xlarge';

export interface DebtItem {
  id: string;
  scanId: string;
  repositoryId: string;
  fingerprint: string;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
  debtType: DebtType;
  severity: Severity;
  confidence: number;
  title: string;
  description: string;
  evidence: Evidence[];
  introducedInCommit: string | null;
  introducedAt: string | null;
  introducedBy: string | null;
  suggestedFix: string | null;
  estimatedEffort: EffortEstimate | null;
  status: DebtStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  type: string;
  content: string;
  location?: {
    file: string;
    startLine: number;
    endLine: number;
  };
}

// Analytics types
export interface DebtTrend {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface Hotspot {
  filePath: string;
  debtCount: number;
  criticalCount: number;
  highCount: number;
}

// API Key types
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// Pagination
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}
