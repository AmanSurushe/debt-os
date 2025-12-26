// Memory System Types

// ============ Core Types ============

export interface MemorySystem {
  episodic: EpisodicMemory;
  semantic: SemanticMemory;
  temporal: TemporalMemory;
}

// ============ Episodic Memory Types ============
// What happened - stores past events, scans, interactions

export interface EpisodicMemory {
  storeScan(scan: ScanResult): Promise<void>;
  getRepoHistory(repoId: string, limit?: number): Promise<ScanSummary[]>;
  storeFeedback(feedback: UserFeedback): Promise<void>;
  getFeedbackForPattern(pattern: DebtPattern): Promise<UserFeedback[]>;
  getRecentScans(limit?: number): Promise<ScanSummary[]>;
  getScanById(scanId: string): Promise<ScanResult | null>;
}

export interface ScanResult {
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

export interface ScanSummary {
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

export interface ScanStats {
  filesAnalyzed: number;
  debtItemsFound: number;
  totalTokensUsed: number;
  durationMs: number;
}

export interface DebtFinding {
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

export interface UserFeedback {
  id: string;
  findingId: string;
  userId: string;
  feedbackType: 'valid' | 'false_positive' | 'severity_adjust' | 'comment';
  comment?: string;
  adjustedSeverity?: string;
  createdAt: Date;
}

// ============ Semantic Memory Types ============
// What we know - patterns, rules, knowledge

export interface SemanticMemory {
  storePattern(pattern: DebtPattern): Promise<void>;
  findSimilarPatterns(embedding: number[], threshold?: number): Promise<DebtPattern[]>;
  storeRule(rule: ArchitectureRule): Promise<void>;
  getRulesFor(context: AnalysisContext): Promise<ArchitectureRule[]>;
  getAllPatterns(): Promise<DebtPattern[]>;
  updatePatternStats(patternId: string, wasValid: boolean): Promise<void>;
}

export interface DebtPattern {
  id: string;
  name: string;
  description: string;
  debtType: string;
  codePattern: string;
  embedding: number[];
  examples: PatternExample[];
  validationStats: PatternValidationStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatternExample {
  code: string;
  language: string;
  filePath?: string;
  isPositive: boolean;
}

export interface PatternValidationStats {
  totalMatches: number;
  confirmedValid: number;
  confirmedFalsePositive: number;
  precision: number;
}

export interface ArchitectureRule {
  id: string;
  repositoryId: string;
  name: string;
  description: string;
  ruleType: 'dependency' | 'naming' | 'structure' | 'layer' | 'custom';
  condition: RuleCondition;
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
  createdAt: Date;
}

export interface RuleCondition {
  type: 'regex' | 'path' | 'import' | 'dependency';
  pattern: string;
  scope?: string;
  message: string;
}

export interface AnalysisContext {
  repositoryId: string;
  filePath?: string;
  language?: string;
  framework?: string;
}

// ============ Temporal Memory Types ============
// How things change over time - trends, history

export interface TemporalMemory {
  trackDebtItem(fingerprint: string, scanId: string, status: DebtStatus): Promise<void>;
  getDebtTrend(fingerprint: string): Promise<DebtTrend>;
  getRepoTrend(repositoryId: string, period: TrendPeriod): Promise<RepoTrend>;
  getDebtVelocity(repositoryId: string): Promise<DebtVelocity>;
  getHotspots(repositoryId: string, limit?: number): Promise<FileHotspot[]>;
}

export interface DebtStatus {
  severity: string;
  confidence: number;
  isResolved: boolean;
}

export interface DebtTrend {
  fingerprint: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  occurrences: TrendDataPoint[];
  status: 'new' | 'recurring' | 'improving' | 'worsening' | 'resolved';
  averageTimeToResolve?: number;
}

export interface TrendDataPoint {
  scanId: string;
  date: Date;
  severity: string;
  confidence: number;
  wasPresent: boolean;
}

export type TrendPeriod = '7d' | '30d' | '90d' | '1y';

export interface RepoTrend {
  repositoryId: string;
  period: TrendPeriod;
  dataPoints: RepoTrendDataPoint[];
  summary: {
    totalDebtChange: number;
    criticalChange: number;
    averageResolutionTime: number;
    topNewDebtTypes: string[];
  };
}

export interface RepoTrendDataPoint {
  date: Date;
  totalDebt: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  resolvedCount: number;
  newCount: number;
}

export interface DebtVelocity {
  repositoryId: string;
  addedPerWeek: number;
  resolvedPerWeek: number;
  netChange: number;
  trend: 'improving' | 'stable' | 'worsening';
}

export interface FileHotspot {
  filePath: string;
  totalFindings: number;
  recurringFindings: number;
  lastModified: Date;
  churnScore: number;
  riskScore: number;
}

// ============ RAG Types ============

export interface RAGContext {
  query: string;
  retrievedChunks: RetrievedChunk[];
  relevantPatterns: DebtPattern[];
  historicalContext: HistoricalContext;
}

export interface RetrievedChunk {
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface HistoricalContext {
  previousFindings: DebtFinding[];
  resolvedFindings: DebtFinding[];
  feedback: UserFeedback[];
  relatedPatterns: DebtPattern[];
}

// ============ Storage Interface ============

export interface MemoryStorage {
  // Generic CRUD operations
  store<T>(collection: string, item: T): Promise<void>;
  get<T>(collection: string, id: string): Promise<T | null>;
  query<T>(collection: string, filter: QueryFilter): Promise<T[]>;
  update<T>(collection: string, id: string, updates: Partial<T>): Promise<void>;
  delete(collection: string, id: string): Promise<void>;

  // Vector operations
  storeVector(collection: string, id: string, vector: number[]): Promise<void>;
  searchVectors(collection: string, query: number[], limit: number, threshold?: number): Promise<VectorSearchResult[]>;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains';
  value: unknown;
}

export interface VectorSearchResult {
  id: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}
