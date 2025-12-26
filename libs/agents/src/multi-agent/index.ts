// Types
export * from './types';

// Agent Roster
export { DEFAULT_AGENT_ROSTER, createAgentRoster, getAgentConfig } from './roster';
export {
  SCANNER_SYSTEM_PROMPT,
  ARCHITECT_SYSTEM_PROMPT,
  HISTORIAN_SYSTEM_PROMPT,
  CRITIC_SYSTEM_PROMPT,
  PLANNER_SYSTEM_PROMPT,
} from './roster';

// Individual Agents
export { createScannerAgent, runScannerAgent } from './agents/scanner';
export type { ScannerAgentConfig } from './agents/scanner';

export { createArchitectAgent, runArchitectAgent } from './agents/architect';
export type { ArchitectAgentConfig } from './agents/architect';

export { createCriticAgent, runCriticAgent, defendFinding } from './agents/critic';
export type { CriticAgentConfig } from './agents/critic';

// Communication
export {
  InMemoryMessageBus,
  createMessageBus,
  createFindingMessage,
  createChallengeMessage,
  createDefenseMessage,
  createConcedeMessage,
  createVoteMessage,
  createConsensusMessage,
} from './communication';

// Debate System
export {
  DebateManager,
  createDebateManager,
  resolveWithArbiter,
  DEFAULT_DEBATE_CONFIG,
} from './debate';

// Conflict Resolution
export {
  detectConflicts,
  resolveConflict,
  mergeFindings,
  ConflictResolver,
} from './resolution';

// Multi-Agent Orchestrator
export {
  createMultiAgentOrchestrator,
  runMultiAgentAnalysis,
} from './orchestrator';
export type {
  MultiAgentOrchestratorConfig,
  MultiAgentAnalysisInput,
  MultiAgentAnalysisOutput,
} from './orchestrator';
