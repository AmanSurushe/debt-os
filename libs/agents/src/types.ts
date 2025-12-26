import { z } from 'zod';

// Agent roles
export type AgentRole = 'analyzer' | 'context' | 'reflection' | 'planning' | 'orchestrator';

// Scan phases
export type ScanPhase = 'ingestion' | 'analysis' | 'reflection' | 'planning' | 'complete';

// Debt types
export type DebtType =
  | 'code_smell'
  | 'complexity'
  | 'duplication'
  | 'dead_code'
  | 'circular_dependency'
  | 'layer_violation'
  | 'god_class'
  | 'feature_envy'
  | 'hardcoded_config'
  | 'security_issue'
  | 'missing_tests'
  | 'missing_docs'
  | 'outdated_dependency'
  | 'vulnerable_dependency';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

// File information
export interface FileInfo {
  path: string;
  language: string | null;
  content: string;
  lineCount: number;
  sizeBytes: number;
}

// Debt finding from analysis
export interface DebtFinding {
  id: string;
  debtType: DebtType;
  severity: Severity;
  confidence: number;
  title: string;
  description: string;
  filePath: string;
  startLine: number | null;
  endLine: number | null;
  evidence: string[];
  suggestedFix: string | null;
}

// Git context information
export interface GitContext {
  commitSha: string;
  authorName: string;
  authorEmail: string;
  date: Date;
  message: string;
}

// Architecture insight
export interface ArchitectureInsight {
  type: 'dependency' | 'pattern' | 'violation' | 'suggestion';
  title: string;
  description: string;
  affectedFiles: string[];
  severity: Severity;
}

// Repository context
export interface RepoContext {
  id: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  languages: string[];
  fileCount: number;
  structure: Record<string, string[]>; // directory -> files
}

// Remediation task
export interface RemediationTask {
  id: string;
  title: string;
  description: string;
  relatedDebtIds: string[];
  estimatedEffort: 'trivial' | 'small' | 'medium' | 'large' | 'xlarge';
  priority: number;
  dependencies: string[];
  suggestedApproach: string;
  risks: string[];
  acceptanceCriteria: string[];
}

// Remediation plan
export interface RemediationPlan {
  id: string;
  scanId: string;
  summary: string;
  totalDebtItems: number;
  prioritizedTasks: RemediationTask[];
  quickWins: RemediationTask[];
  strategicWork: RemediationTask[];
  deferrable: RemediationTask[];
}

// Agent error
export interface AgentError {
  agent: AgentRole;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

// Base agent state
export interface BaseAgentState {
  repositoryId: string;
  scanId: string;
  errors: AgentError[];
  shouldContinue: boolean;
}

// Analyzer agent state
export interface AnalyzerState extends BaseAgentState {
  files: FileInfo[];
  currentFileIndex: number;
  findings: DebtFinding[];
  filesAnalyzed: string[];
  phase: 'selecting' | 'analyzing' | 'validating' | 'complete';
}

// Context agent state
export interface ContextState extends BaseAgentState {
  targetFile: string;
  gitHistory: GitContext[];
  relatedChanges: GitContext[];
  contextReport: string | null;
}

// Reflection agent state
export interface ReflectionState extends BaseAgentState {
  findings: DebtFinding[];
  validatedFindings: DebtFinding[];
  rejectedFindings: Array<{ finding: DebtFinding; reason: string }>;
  confidenceAdjustments: Record<string, number>;
  currentFindingIndex: number;
}

// Planning agent state
export interface PlanningState extends BaseAgentState {
  debtItems: DebtFinding[];
  dependencies: Array<{ from: string; to: string }>;
  remediationPlan: RemediationPlan | null;
  tasks: RemediationTask[];
}

// Orchestrator state
export interface OrchestratorState extends BaseAgentState {
  phase: ScanPhase;
  repoContext: RepoContext;
  analyzerResults: DebtFinding[];
  contextResults: Map<string, GitContext[]>;
  reflectionResults: {
    validated: DebtFinding[];
    rejected: Array<{ finding: DebtFinding; reason: string }>;
  };
  planningResults: RemediationPlan | null;
  stats: {
    filesAnalyzed: number;
    findingsCount: number;
    validatedCount: number;
    rejectedCount: number;
    tasksCreated: number;
  };
}

// Tool definitions
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Agent configuration
export interface AgentConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  maxRetries: number;
  timeoutMs: number;
}

// Zod schemas for structured output
export const DebtFindingSchema = z.object({
  debtType: z.enum([
    'code_smell', 'complexity', 'duplication', 'dead_code',
    'circular_dependency', 'layer_violation', 'god_class', 'feature_envy',
    'hardcoded_config', 'security_issue', 'missing_tests', 'missing_docs',
    'outdated_dependency', 'vulnerable_dependency',
  ]),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  confidence: z.number().min(0).max(1),
  title: z.string().max(100),
  description: z.string().max(500),
  startLine: z.number().nullable(),
  endLine: z.number().nullable(),
  evidence: z.array(z.string()),
  suggestedFix: z.string().nullable(),
});

export const AnalysisResultSchema = z.object({
  findings: z.array(DebtFindingSchema),
  overallAssessment: z.string().max(300),
  fileHealthScore: z.number().min(0).max(100),
});

export const ReflectionResultSchema = z.object({
  isValid: z.boolean(),
  adjustedConfidence: z.number().min(0).max(1),
  reason: z.string(),
  additionalEvidence: z.array(z.string()).optional(),
});

export const RemediationTaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  relatedDebtIds: z.array(z.string()),
  estimatedEffort: z.enum(['trivial', 'small', 'medium', 'large', 'xlarge']),
  priority: z.number().min(1).max(10),
  dependencies: z.array(z.string()),
  suggestedApproach: z.string(),
  risks: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
});
