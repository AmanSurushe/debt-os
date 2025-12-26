import { DebtFinding, FileInfo, GitContext, AgentError } from '../types';

// ============ Agent Roles ============

export type AgentRole = 'scanner' | 'architect' | 'historian' | 'critic' | 'planner';

export interface AgentConfig {
  role: AgentRole;
  model: 'gpt-4o' | 'claude-3-5-sonnet-latest' | 'claude-opus-4';
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  tools: string[];
}

export interface AgentRoster {
  scanner: AgentConfig;
  architect: AgentConfig;
  historian: AgentConfig;
  critic: AgentConfig;
  planner: AgentConfig;
}

// ============ Agent Communication ============

export type MessageType =
  | 'finding'           // Report a finding
  | 'challenge'         // Challenge a finding
  | 'evidence'          // Provide supporting evidence
  | 'concede'           // Accept a challenge
  | 'defend'            // Defend against challenge
  | 'escalate'          // Escalate to higher authority
  | 'consensus'         // Propose consensus
  | 'vote';             // Vote on proposal

export interface AgentMessage {
  id: string;
  from: AgentRole;
  to: AgentRole | 'broadcast';
  type: MessageType;
  content: MessageContent;
  timestamp: Date;
  inReplyTo?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageContent {
  text: string;
  finding?: DebtFinding;
  evidence?: string[];
  vote?: boolean;
  confidence?: number;
}

export interface MessageBus {
  publish(message: AgentMessage): void;
  subscribe(role: AgentRole, callback: (message: AgentMessage) => void): void;
  getMessages(filter?: MessageFilter): AgentMessage[];
}

export interface MessageFilter {
  from?: AgentRole;
  to?: AgentRole | 'broadcast';
  type?: MessageType;
  afterTimestamp?: Date;
  relatedToFinding?: string;
}

// ============ Debate System ============

export interface Debate {
  id: string;
  topic: DebtFinding;
  initiator: AgentRole;
  challenger: AgentRole;
  messages: AgentMessage[];
  status: 'active' | 'resolved' | 'escalated';
  startedAt: Date;
  resolvedAt?: Date;
  resolution?: DebateResolution;
}

export interface DebateResolution {
  accepted: boolean;
  reason: string;
  votes: Record<AgentRole, boolean>;
  finalConfidence: number;
  adjustedSeverity?: string;
}

export type ResolutionStrategy = 'majority' | 'weighted' | 'conservative' | 'unanimous';

export interface DebateConfig {
  maxRounds: number;
  timeoutMs: number;
  resolutionStrategy: ResolutionStrategy;
  requireEvidenceForChallenge: boolean;
}

// ============ Conflict Resolution ============

export type ConflictType =
  | 'contradictory_findings'
  | 'severity_disagreement'
  | 'classification_dispute'
  | 'scope_disagreement';

export interface Conflict {
  id: string;
  type: ConflictType;
  parties: AgentRole[];
  claims: Claim[];
  evidence: Evidence[];
  createdAt: Date;
}

export interface Claim {
  agent: AgentRole;
  finding: DebtFinding;
  rationale: string;
  confidence: number;
}

export interface Evidence {
  agent: AgentRole;
  type: 'code' | 'history' | 'pattern' | 'documentation';
  content: string;
  supports: string; // Finding ID or claim
  weight: number;
}

export interface Resolution {
  conflictId: string;
  decision: 'accept_first' | 'accept_second' | 'merge' | 'reject_both';
  reasoning: string;
  resultingFinding?: DebtFinding;
  resolvedBy: 'vote' | 'arbiter' | 'evidence';
}

// ============ Multi-Agent State ============

export interface MultiAgentState {
  // Context
  repositoryId: string;
  scanId: string;
  files: FileInfo[];

  // Agent findings
  scannerFindings: DebtFinding[];
  architectFindings: DebtFinding[];
  historianContext: Map<string, GitContext[]>;

  // Debates and conflicts
  debates: Debate[];
  conflicts: Conflict[];

  // Critic reviews
  criticReviews: CriticReview[];

  // Final outputs
  validatedFindings: DebtFinding[];
  rejectedFindings: RejectedFinding[];
  plan: RemediationPlan | null;

  // Metadata
  messages: AgentMessage[];
  errors: AgentError[];
  phase: MultiAgentPhase;
}

export type MultiAgentPhase =
  | 'discovery'      // Parallel finding discovery
  | 'debate'         // Critic challenges findings
  | 'resolution'     // Resolve debates and conflicts
  | 'planning'       // Create remediation plan
  | 'complete';

export interface CriticReview {
  findingId: string;
  accepted: boolean;
  confidence: number;
  reason: string;
  suggestedAdjustments?: {
    severity?: string;
    title?: string;
    description?: string;
  };
}

export interface RejectedFinding {
  finding: DebtFinding;
  rejectedBy: AgentRole;
  reason: string;
  debateId?: string;
}

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

// ============ Agent Weights ============

// Weights for different agents based on finding type
export const AGENT_WEIGHTS: Record<string, Record<AgentRole, number>> = {
  // Code-level issues
  code_smell: { scanner: 0.4, architect: 0.2, historian: 0.1, critic: 0.2, planner: 0.1 },
  complexity: { scanner: 0.3, architect: 0.3, historian: 0.1, critic: 0.2, planner: 0.1 },
  duplication: { scanner: 0.4, architect: 0.2, historian: 0.2, critic: 0.1, planner: 0.1 },
  dead_code: { scanner: 0.3, architect: 0.1, historian: 0.4, critic: 0.1, planner: 0.1 },

  // Architectural issues
  circular_dependency: { scanner: 0.1, architect: 0.5, historian: 0.1, critic: 0.2, planner: 0.1 },
  layer_violation: { scanner: 0.1, architect: 0.5, historian: 0.1, critic: 0.2, planner: 0.1 },
  god_class: { scanner: 0.2, architect: 0.4, historian: 0.1, critic: 0.2, planner: 0.1 },
  feature_envy: { scanner: 0.2, architect: 0.4, historian: 0.1, critic: 0.2, planner: 0.1 },

  // Security issues
  security_issue: { scanner: 0.3, architect: 0.2, historian: 0.1, critic: 0.3, planner: 0.1 },
  hardcoded_config: { scanner: 0.4, architect: 0.1, historian: 0.2, critic: 0.2, planner: 0.1 },

  // Testing issues
  missing_tests: { scanner: 0.2, architect: 0.2, historian: 0.3, critic: 0.2, planner: 0.1 },
  low_coverage: { scanner: 0.2, architect: 0.2, historian: 0.3, critic: 0.2, planner: 0.1 },

  // Default
  default: { scanner: 0.25, architect: 0.25, historian: 0.2, critic: 0.2, planner: 0.1 },
};

export function getAgentWeights(debtType: string): Record<AgentRole, number> {
  return AGENT_WEIGHTS[debtType] || AGENT_WEIGHTS.default;
}
