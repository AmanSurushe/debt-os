import { StateGraph, Annotation } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';
import {
  OrchestratorState,
  ScanPhase,
  FileInfo,
  DebtFinding,
  GitContext,
  RemediationPlan,
  AgentError,
  RepoContext,
} from '../types';
import { ToolContext } from '../tools';
import { runAnalyzer, AnalyzerConfig } from '../analyzer/graph';
import { runContextAgent, ContextConfig } from '../context/graph';
import { runReflectionAgent, ReflectionConfig } from '../reflection/graph';
import { runPlanningAgent, PlanningConfig } from '../planning/graph';

// State annotation for LangGraph
const OrchestratorStateAnnotation = Annotation.Root({
  repositoryId: Annotation<string>,
  scanId: Annotation<string>,
  phase: Annotation<ScanPhase>,
  repoContext: Annotation<RepoContext>,
  files: Annotation<FileInfo[]>,
  analyzerResults: Annotation<DebtFinding[]>,
  contextResults: Annotation<Map<string, GitContext[]>>,
  reflectionResults: Annotation<{
    validated: DebtFinding[];
    rejected: Array<{ finding: DebtFinding; reason: string }>;
  }>,
  planningResults: Annotation<RemediationPlan | null>,
  stats: Annotation<{
    filesAnalyzed: number;
    findingsCount: number;
    validatedCount: number;
    rejectedCount: number;
    tasksCreated: number;
  }>,
  errors: Annotation<AgentError[]>,
  shouldContinue: Annotation<boolean>,
});

type OrchestratorGraphState = typeof OrchestratorStateAnnotation.State;

export interface OrchestratorConfig {
  model: 'gpt-4o' | 'claude-3-5-sonnet-latest';
  openaiApiKey?: string;
  anthropicApiKey?: string;
  maxFilesPerBatch: number;
  maxTokensPerFile: number;
  maxCommits: number;
  confidenceThreshold: number;
  toolContext: ToolContext;
  onPhaseChange?: (phase: ScanPhase, stats: OrchestratorGraphState['stats']) => void;
  onFindingDiscovered?: (finding: DebtFinding) => void;
}

export function createOrchestratorGraph(config: OrchestratorConfig) {
  // Node: Run ingestion phase (files are already loaded)
  async function runIngestion(state: OrchestratorGraphState): Promise<Partial<OrchestratorGraphState>> {
    const { files } = state;

    // Files should already be loaded before orchestration starts
    if (files.length === 0) {
      return {
        phase: 'complete' as ScanPhase,
        shouldContinue: false,
        errors: [
          ...state.errors,
          {
            agent: 'orchestrator' as const,
            message: 'No files provided for analysis',
            timestamp: new Date(),
            recoverable: false,
          },
        ],
      };
    }

    config.onPhaseChange?.('analysis', state.stats);

    return {
      phase: 'analysis' as ScanPhase,
      stats: {
        ...state.stats,
        filesAnalyzed: 0,
      },
    };
  }

  // Node: Run analysis phase
  async function runAnalysis(state: OrchestratorGraphState): Promise<Partial<OrchestratorGraphState>> {
    const { repositoryId, scanId, files } = state;

    try {
      const analyzerConfig: AnalyzerConfig = {
        model: config.model,
        openaiApiKey: config.openaiApiKey,
        anthropicApiKey: config.anthropicApiKey,
        maxFilesPerBatch: config.maxFilesPerBatch,
        maxTokensPerFile: config.maxTokensPerFile,
        toolContext: config.toolContext,
      };

      const result = await runAnalyzer(analyzerConfig, {
        repositoryId,
        scanId,
        files,
      });

      // Notify about findings
      for (const finding of result.findings) {
        config.onFindingDiscovered?.(finding);
      }

      config.onPhaseChange?.('reflection', {
        ...state.stats,
        filesAnalyzed: result.filesAnalyzed.length,
        findingsCount: result.findings.length,
      });

      return {
        phase: 'reflection' as ScanPhase,
        analyzerResults: result.findings,
        stats: {
          ...state.stats,
          filesAnalyzed: result.filesAnalyzed.length,
          findingsCount: result.findings.length,
        },
        errors: [...state.errors, ...result.errors],
      };
    } catch (error) {
      return {
        phase: 'complete' as ScanPhase,
        shouldContinue: false,
        errors: [
          ...state.errors,
          {
            agent: 'orchestrator' as const,
            message: `Analysis phase failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            recoverable: false,
          },
        ],
      };
    }
  }

  // Node: Run reflection phase
  async function runReflection(state: OrchestratorGraphState): Promise<Partial<OrchestratorGraphState>> {
    const { repositoryId, scanId, analyzerResults } = state;

    if (analyzerResults.length === 0) {
      config.onPhaseChange?.('planning', state.stats);
      return {
        phase: 'planning' as ScanPhase,
        reflectionResults: { validated: [], rejected: [] },
      };
    }

    try {
      const reflectionConfig: ReflectionConfig = {
        model: config.model,
        openaiApiKey: config.openaiApiKey,
        anthropicApiKey: config.anthropicApiKey,
        confidenceThreshold: config.confidenceThreshold,
        toolContext: config.toolContext,
      };

      const result = await runReflectionAgent(reflectionConfig, {
        repositoryId,
        scanId,
        findings: analyzerResults,
      });

      config.onPhaseChange?.('planning', {
        ...state.stats,
        validatedCount: result.validatedFindings.length,
        rejectedCount: result.rejectedFindings.length,
      });

      return {
        phase: 'planning' as ScanPhase,
        reflectionResults: {
          validated: result.validatedFindings,
          rejected: result.rejectedFindings,
        },
        stats: {
          ...state.stats,
          validatedCount: result.validatedFindings.length,
          rejectedCount: result.rejectedFindings.length,
        },
        errors: [...state.errors, ...result.errors],
      };
    } catch (error) {
      // On reflection failure, keep original findings
      return {
        phase: 'planning' as ScanPhase,
        reflectionResults: {
          validated: analyzerResults,
          rejected: [],
        },
        errors: [
          ...state.errors,
          {
            agent: 'orchestrator' as const,
            message: `Reflection phase failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
      };
    }
  }

  // Node: Run planning phase
  async function runPlanning(state: OrchestratorGraphState): Promise<Partial<OrchestratorGraphState>> {
    const { repositoryId, scanId, reflectionResults } = state;

    if (reflectionResults.validated.length === 0) {
      config.onPhaseChange?.('complete', state.stats);
      return {
        phase: 'complete' as ScanPhase,
        planningResults: null,
        shouldContinue: false,
      };
    }

    try {
      const planningConfig: PlanningConfig = {
        model: config.model,
        openaiApiKey: config.openaiApiKey,
        anthropicApiKey: config.anthropicApiKey,
        toolContext: config.toolContext,
      };

      const result = await runPlanningAgent(planningConfig, {
        repositoryId,
        scanId,
        debtItems: reflectionResults.validated,
      });

      config.onPhaseChange?.('complete', {
        ...state.stats,
        tasksCreated: result.tasks.length,
      });

      return {
        phase: 'complete' as ScanPhase,
        planningResults: result.remediationPlan,
        stats: {
          ...state.stats,
          tasksCreated: result.tasks.length,
        },
        errors: [...state.errors, ...result.errors],
        shouldContinue: false,
      };
    } catch (error) {
      return {
        phase: 'complete' as ScanPhase,
        planningResults: null,
        shouldContinue: false,
        errors: [
          ...state.errors,
          {
            agent: 'orchestrator' as const,
            message: `Planning phase failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
      };
    }
  }

  // Routing function
  function routeByPhase(state: OrchestratorGraphState): string {
    if (!state.shouldContinue) {
      return '__end__';
    }

    switch (state.phase) {
      case 'ingestion':
        return 'runIngestion';
      case 'analysis':
        return 'runAnalysis';
      case 'reflection':
        return 'runReflection';
      case 'planning':
        return 'runPlanning';
      case 'complete':
        return '__end__';
      default:
        return '__end__';
    }
  }

  // Build the graph
  const graph = new StateGraph(OrchestratorStateAnnotation)
    .addNode('runIngestion', runIngestion)
    .addNode('runAnalysis', runAnalysis)
    .addNode('runReflection', runReflection)
    .addNode('runPlanning', runPlanning)
    .addConditionalEdges('__start__', routeByPhase)
    .addConditionalEdges('runIngestion', routeByPhase)
    .addConditionalEdges('runAnalysis', routeByPhase)
    .addConditionalEdges('runReflection', routeByPhase)
    .addConditionalEdges('runPlanning', routeByPhase);

  return graph.compile();
}

// Main entry point for running a complete scan
export interface ScanInput {
  repositoryId: string;
  scanId: string;
  repoContext: RepoContext;
  files: FileInfo[];
}

export interface ScanOutput {
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

export async function runScan(config: OrchestratorConfig, input: ScanInput): Promise<ScanOutput> {
  const graph = createOrchestratorGraph(config);

  const initialState: OrchestratorGraphState = {
    repositoryId: input.repositoryId,
    scanId: input.scanId,
    phase: 'ingestion',
    repoContext: input.repoContext,
    files: input.files,
    analyzerResults: [],
    contextResults: new Map(),
    reflectionResults: { validated: [], rejected: [] },
    planningResults: null,
    stats: {
      filesAnalyzed: 0,
      findingsCount: 0,
      validatedCount: 0,
      rejectedCount: 0,
      tasksCreated: 0,
    },
    errors: [],
    shouldContinue: true,
  };

  const result = await graph.invoke(initialState);

  return {
    findings: result.analyzerResults,
    validatedFindings: result.reflectionResults.validated,
    rejectedFindings: result.reflectionResults.rejected,
    remediationPlan: result.planningResults,
    stats: result.stats,
    errors: result.errors,
  };
}

// Helper to run context analysis for specific files
export async function runContextAnalysis(
  config: OrchestratorConfig,
  input: {
    repositoryId: string;
    scanId: string;
    files: string[];
  },
): Promise<Map<string, GitContext[]>> {
  const contextResults = new Map<string, GitContext[]>();

  const contextConfig: ContextConfig = {
    model: config.model,
    openaiApiKey: config.openaiApiKey,
    anthropicApiKey: config.anthropicApiKey,
    maxCommits: config.maxCommits,
    toolContext: config.toolContext,
  };

  for (const filePath of input.files) {
    try {
      const result = await runContextAgent(contextConfig, {
        repositoryId: input.repositoryId,
        scanId: input.scanId,
        targetFile: filePath,
      });
      contextResults.set(filePath, result.gitHistory);
    } catch {
      // Skip files that fail context analysis
    }
  }

  return contextResults;
}
