import { StateGraph, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { v4 as uuidv4 } from 'uuid';
import { DebtFinding, FileInfo, AgentError, RepoContext, GitContext } from '../types';
import {
  MultiAgentState,
  MultiAgentPhase,
  AgentRoster,
  CriticReview,
  RejectedFinding,
  RemediationPlan,
  RemediationTask,
  Debate,
  Conflict,
  AgentMessage,
} from './types';
import { DEFAULT_AGENT_ROSTER } from './roster';
import { ToolContext } from '../tools';
import { createMessageBus, createFindingMessage } from './communication';
import { runScannerAgent } from './agents/scanner';
import { runArchitectAgent } from './agents/architect';
import { runCriticAgent } from './agents/critic';
import { createDebateManager, resolveWithArbiter } from './debate';
import { detectConflicts, ConflictResolver, mergeFindings } from './resolution';

// State annotation for LangGraph
const MultiAgentStateAnnotation = Annotation.Root({
  repositoryId: Annotation<string>,
  scanId: Annotation<string>,
  repoContext: Annotation<RepoContext>,
  files: Annotation<FileInfo[]>,
  scannerFindings: Annotation<DebtFinding[]>,
  architectFindings: Annotation<DebtFinding[]>,
  historianContext: Annotation<Map<string, GitContext[]>>,
  debates: Annotation<Debate[]>,
  conflicts: Annotation<Conflict[]>,
  criticReviews: Annotation<CriticReview[]>,
  validatedFindings: Annotation<DebtFinding[]>,
  rejectedFindings: Annotation<RejectedFinding[]>,
  plan: Annotation<RemediationPlan | null>,
  messages: Annotation<AgentMessage[]>,
  errors: Annotation<AgentError[]>,
  phase: Annotation<MultiAgentPhase>,
});

type OrchestratorState = typeof MultiAgentStateAnnotation.State;

export interface MultiAgentOrchestratorConfig {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  roster?: AgentRoster;
  toolContext: ToolContext;
  maxDebateRounds?: number;
  onPhaseChange?: (phase: MultiAgentPhase) => void;
  onFindingDiscovered?: (finding: DebtFinding, agent: string) => void;
  onDebateStarted?: (debate: Debate) => void;
  onDebateResolved?: (debate: Debate) => void;
}

export function createMultiAgentOrchestrator(config: MultiAgentOrchestratorConfig) {
  const roster = config.roster || DEFAULT_AGENT_ROSTER;
  const messageBus = createMessageBus();
  const debateManager = createDebateManager({
    maxRounds: config.maxDebateRounds || 3,
  });

  // Create LLM for arbiter
  const arbiterLLM = new ChatAnthropic({
    modelName: 'claude-3-5-sonnet-latest',
    temperature: 0.1,
    anthropicApiKey: config.anthropicApiKey,
  });

  const conflictResolver = new ConflictResolver(arbiterLLM);

  // Phase 1: Parallel Discovery
  async function runDiscovery(state: OrchestratorState): Promise<Partial<OrchestratorState>> {
    config.onPhaseChange?.('discovery');

    const { files, repoContext } = state;
    const errors: AgentError[] = [...state.errors];

    // Run scanner and architect in parallel
    const [scannerResult, architectResult] = await Promise.all([
      runScannerAgent(
        {
          agentConfig: roster.scanner,
          openaiApiKey: config.openaiApiKey,
          anthropicApiKey: config.anthropicApiKey,
          toolContext: config.toolContext,
        },
        files,
      ).catch((e) => {
        errors.push({
          agent: 'scanner',
          message: `Scanner failed: ${e instanceof Error ? e.message : 'Unknown'}`,
          timestamp: new Date(),
          recoverable: false,
        });
        return { findings: [], errors: [] };
      }),

      runArchitectAgent(
        {
          agentConfig: roster.architect,
          openaiApiKey: config.openaiApiKey,
          anthropicApiKey: config.anthropicApiKey,
          toolContext: config.toolContext,
        },
        repoContext,
        files,
      ).catch((e) => {
        errors.push({
          agent: 'architect',
          message: `Architect failed: ${e instanceof Error ? e.message : 'Unknown'}`,
          timestamp: new Date(),
          recoverable: false,
        });
        return { findings: [], errors: [] };
      }),
    ]);

    // Publish findings to message bus
    const messages: AgentMessage[] = [];
    for (const finding of scannerResult.findings) {
      const msg = createFindingMessage('scanner', finding);
      messageBus.publish(msg);
      messages.push(msg);
      config.onFindingDiscovered?.(finding, 'scanner');
    }

    for (const finding of architectResult.findings) {
      const msg = createFindingMessage('architect', finding);
      messageBus.publish(msg);
      messages.push(msg);
      config.onFindingDiscovered?.(finding, 'architect');
    }

    return {
      scannerFindings: scannerResult.findings,
      architectFindings: architectResult.findings,
      messages,
      errors: [...errors, ...scannerResult.errors, ...architectResult.errors],
      phase: 'debate',
    };
  }

  // Phase 2: Critic Review and Debate
  async function runDebate(state: OrchestratorState): Promise<Partial<OrchestratorState>> {
    config.onPhaseChange?.('debate');

    const { scannerFindings, architectFindings } = state;
    const allFindings = [...scannerFindings, ...architectFindings];

    // Run critic on all findings
    const criticResult = await runCriticAgent(
      {
        agentConfig: roster.critic,
        openaiApiKey: config.openaiApiKey,
        anthropicApiKey: config.anthropicApiKey,
        toolContext: config.toolContext,
      },
      allFindings,
    );

    // Start debates for challenged findings
    const debates: Debate[] = [];
    for (const challenge of criticResult.challenges) {
      if (challenge.content.finding) {
        const initiator = scannerFindings.some((f) => f.id === challenge.content.finding?.id)
          ? 'scanner'
          : 'architect';

        const debate = debateManager.startDebate(
          challenge.content.finding,
          initiator,
          'critic',
          challenge.content.text,
        );
        debates.push(debate);
        config.onDebateStarted?.(debate);
      }
    }

    return {
      criticReviews: criticResult.reviews,
      debates,
      messages: [...state.messages, ...criticResult.challenges],
      errors: [...state.errors, ...criticResult.errors],
      phase: 'resolution',
    };
  }

  // Phase 3: Resolve Debates and Conflicts
  async function runResolution(state: OrchestratorState): Promise<Partial<OrchestratorState>> {
    config.onPhaseChange?.('resolution');

    const { scannerFindings, architectFindings, debates, criticReviews } = state;

    // Resolve active debates
    const resolvedDebates: Debate[] = [];
    for (const debate of debates) {
      if (debate.status === 'active') {
        // Use arbiter for complex debates
        if (debate.messages.length > 2) {
          const resolution = await resolveWithArbiter(debate, arbiterLLM);
          debate.resolution = resolution;
          debate.status = 'resolved';
        } else {
          debateManager.resolveDebate(debate.id);
        }
        config.onDebateResolved?.(debate);
      }
      resolvedDebates.push(debate);
    }

    // Detect conflicts between agents
    const conflicts = detectConflicts(scannerFindings, architectFindings);

    // Resolve conflicts
    const resolutions = await conflictResolver.resolveAll(conflicts);

    // Categorize findings
    const validatedFindings: DebtFinding[] = [];
    const rejectedFindings: RejectedFinding[] = [];

    const allFindings = [...scannerFindings, ...architectFindings];
    const findingIdToReview = new Map<string, CriticReview>();

    for (const review of criticReviews) {
      findingIdToReview.set(review.findingId, review);
    }

    // Get findings that were debated
    const debatedFindingIds = new Set(resolvedDebates.map((d) => d.topic.id));

    for (const finding of allFindings) {
      const review = findingIdToReview.get(finding.id);
      const debate = resolvedDebates.find((d) => d.topic.id === finding.id);

      // Check debate result first
      if (debate && debate.resolution) {
        if (debate.resolution.accepted) {
          validatedFindings.push({
            ...finding,
            confidence: debate.resolution.finalConfidence,
          });
        } else {
          rejectedFindings.push({
            finding,
            rejectedBy: 'critic',
            reason: debate.resolution.reason,
            debateId: debate.id,
          });
        }
        continue;
      }

      // Check critic review
      if (review) {
        if (review.accepted) {
          validatedFindings.push({
            ...finding,
            confidence: review.confidence,
          });
        } else {
          rejectedFindings.push({
            finding,
            rejectedBy: 'critic',
            reason: review.reason,
          });
        }
        continue;
      }

      // No review - accept by default
      validatedFindings.push(finding);
    }

    // Apply conflict resolutions
    for (const resolution of resolutions) {
      if (resolution.resultingFinding) {
        // Find and replace conflicting findings
        const conflictingIds = conflicts
          .find((c) => c.id === resolution.conflictId)
          ?.claims.map((c) => c.finding.id) || [];

        // Remove conflicting findings from validated
        const filtered = validatedFindings.filter((f) => !conflictingIds.includes(f.id));
        validatedFindings.length = 0;
        validatedFindings.push(...filtered, resolution.resultingFinding);
      }
    }

    return {
      debates: resolvedDebates,
      conflicts,
      validatedFindings,
      rejectedFindings,
      phase: 'planning',
    };
  }

  // Phase 4: Create Remediation Plan
  async function runPlanning(state: OrchestratorState): Promise<Partial<OrchestratorState>> {
    config.onPhaseChange?.('planning');

    const { scanId, validatedFindings } = state;

    if (validatedFindings.length === 0) {
      return {
        plan: {
          id: uuidv4(),
          scanId,
          summary: 'No technical debt findings to address.',
          totalDebtItems: 0,
          prioritizedTasks: [],
          quickWins: [],
          strategicWork: [],
          deferrable: [],
        },
        phase: 'complete',
      };
    }

    // Group findings into tasks
    const tasks = createRemediationTasks(validatedFindings);

    // Categorize tasks
    const quickWins = tasks.filter(
      (t) => (t.estimatedEffort === 'trivial' || t.estimatedEffort === 'small') && t.dependencies.length === 0,
    );

    const strategicWork = tasks.filter(
      (t) => t.estimatedEffort === 'medium' || t.estimatedEffort === 'large' || t.priority <= 3,
    );

    const deferrable = tasks.filter((t) => t.priority > 7);

    // Generate summary
    const criticalCount = validatedFindings.filter((f) => f.severity === 'critical').length;
    const highCount = validatedFindings.filter((f) => f.severity === 'high').length;

    let summary = `Found ${validatedFindings.length} technical debt items. `;
    if (criticalCount > 0) summary += `${criticalCount} critical issues need immediate attention. `;
    if (highCount > 0) summary += `${highCount} high-priority items should be addressed soon. `;
    summary += `Organized into ${tasks.length} tasks with ${quickWins.length} quick wins.`;

    const plan: RemediationPlan = {
      id: uuidv4(),
      scanId,
      summary,
      totalDebtItems: validatedFindings.length,
      prioritizedTasks: tasks,
      quickWins,
      strategicWork,
      deferrable,
    };

    return {
      plan,
      phase: 'complete',
    };
  }

  // Build the orchestrator graph
  const graph = new StateGraph(MultiAgentStateAnnotation)
    .addNode('discovery', runDiscovery)
    .addNode('debate', runDebate)
    .addNode('resolution', runResolution)
    .addNode('planning', runPlanning)
    .addEdge('__start__', 'discovery')
    .addEdge('discovery', 'debate')
    .addEdge('debate', 'resolution')
    .addEdge('resolution', 'planning')
    .addEdge('planning', '__end__');

  return graph.compile();
}

// Helper to create remediation tasks from findings
function createRemediationTasks(findings: DebtFinding[]): RemediationTask[] {
  const severityPriority: Record<string, number> = {
    critical: 1,
    high: 3,
    medium: 5,
    low: 7,
    info: 9,
  };

  const effortByType: Record<string, RemediationTask['estimatedEffort']> = {
    hardcoded_config: 'trivial',
    missing_docs: 'small',
    code_smell: 'small',
    dead_code: 'small',
    complexity: 'medium',
    duplication: 'medium',
    missing_tests: 'medium',
    god_class: 'large',
    feature_envy: 'medium',
    circular_dependency: 'large',
    layer_violation: 'large',
    security_issue: 'xlarge',
  };

  // Group findings by file for better task organization
  const byFile = new Map<string, DebtFinding[]>();
  for (const f of findings) {
    const existing = byFile.get(f.filePath) || [];
    existing.push(f);
    byFile.set(f.filePath, existing);
  }

  const tasks: RemediationTask[] = [];

  for (const [filePath, fileFindings] of byFile) {
    // Group by type within file
    const byType = new Map<string, DebtFinding[]>();
    for (const f of fileFindings) {
      const existing = byType.get(f.debtType) || [];
      existing.push(f);
      byType.set(f.debtType, existing);
    }

    for (const [debtType, typeFindings] of byType) {
      const highestSeverity = typeFindings.reduce((max, f) =>
        severityPriority[f.severity] < severityPriority[max.severity] ? f : max,
      );

      tasks.push({
        id: uuidv4(),
        title: `Fix ${debtType.replace('_', ' ')} in ${filePath.split('/').pop()}`,
        description: typeFindings.map((f) => f.title).join('; '),
        relatedDebtIds: typeFindings.map((f) => f.id),
        estimatedEffort: effortByType[debtType] || 'medium',
        priority: severityPriority[highestSeverity.severity],
        dependencies: [],
        suggestedApproach: highestSeverity.suggestedFix || 'Review and refactor the identified code.',
        risks: ['Regression in related functionality'],
        acceptanceCriteria: ['Issue no longer present in code analysis'],
      });
    }
  }

  // Sort by priority
  return tasks.sort((a, b) => a.priority - b.priority);
}

// Main entry point
export interface MultiAgentAnalysisInput {
  repositoryId: string;
  scanId: string;
  repoContext: RepoContext;
  files: FileInfo[];
}

export interface MultiAgentAnalysisOutput {
  validatedFindings: DebtFinding[];
  rejectedFindings: RejectedFinding[];
  debates: Debate[];
  conflicts: Conflict[];
  plan: RemediationPlan | null;
  errors: AgentError[];
}

export async function runMultiAgentAnalysis(
  config: MultiAgentOrchestratorConfig,
  input: MultiAgentAnalysisInput,
): Promise<MultiAgentAnalysisOutput> {
  const orchestrator = createMultiAgentOrchestrator(config);

  const initialState: OrchestratorState = {
    repositoryId: input.repositoryId,
    scanId: input.scanId,
    repoContext: input.repoContext,
    files: input.files,
    scannerFindings: [],
    architectFindings: [],
    historianContext: new Map(),
    debates: [],
    conflicts: [],
    criticReviews: [],
    validatedFindings: [],
    rejectedFindings: [],
    plan: null,
    messages: [],
    errors: [],
    phase: 'discovery',
  };

  const result = await orchestrator.invoke(initialState);

  return {
    validatedFindings: result.validatedFindings,
    rejectedFindings: result.rejectedFindings,
    debates: result.debates,
    conflicts: result.conflicts,
    plan: result.plan,
    errors: result.errors,
  };
}
