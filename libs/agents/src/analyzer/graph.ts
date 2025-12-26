import { StateGraph, Annotation, END } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
import {
  AnalyzerState,
  FileInfo,
  DebtFinding,
  AgentError,
  AnalysisResultSchema,
} from '../types';
import { ToolContext, createFileTools, createAnalysisTools } from '../tools';

// State annotation for LangGraph
const AnalyzerStateAnnotation = Annotation.Root({
  repositoryId: Annotation<string>,
  scanId: Annotation<string>,
  files: Annotation<FileInfo[]>,
  currentFileIndex: Annotation<number>,
  findings: Annotation<DebtFinding[]>,
  filesAnalyzed: Annotation<string[]>,
  phase: Annotation<'selecting' | 'analyzing' | 'validating' | 'complete'>,
  errors: Annotation<AgentError[]>,
  shouldContinue: Annotation<boolean>,
});

type AnalyzerGraphState = typeof AnalyzerStateAnnotation.State;

export interface AnalyzerConfig {
  model: 'gpt-4o' | 'claude-3-5-sonnet-latest';
  openaiApiKey?: string;
  anthropicApiKey?: string;
  maxFilesPerBatch: number;
  maxTokensPerFile: number;
  toolContext: ToolContext;
}

const ANALYZER_SYSTEM_PROMPT = `You are a senior software engineer analyzing code for technical debt.

Your task is to identify technical debt in the provided code file. Consider:
- Code smells (long methods, deep nesting, magic numbers, poor naming)
- Design issues (god classes, feature envy, inappropriate intimacy)
- Maintainability concerns (missing abstractions, complex conditionals)
- Potential bugs or security issues
- Missing or inadequate error handling
- Performance anti-patterns

Be precise and actionable. Only flag genuine issues, not stylistic preferences.
Focus on issues that would make the code harder to maintain or extend.

For each issue found, provide:
1. Type of debt (from predefined categories)
2. Severity (critical/high/medium/low/info)
3. Location (line numbers)
4. Clear description
5. Why it's problematic
6. Suggested fix
7. Your confidence level (0.0-1.0)

Be conservative - only report issues you're confident about. False positives waste developer time.`;

export function createAnalyzerGraph(config: AnalyzerConfig) {
  // Initialize LLM
  const llm = config.model.startsWith('gpt')
    ? new ChatOpenAI({
        modelName: config.model,
        temperature: 0.3,
        openAIApiKey: config.openaiApiKey,
      })
    : new ChatAnthropic({
        modelName: config.model,
        temperature: 0.3,
        anthropicApiKey: config.anthropicApiKey,
      });

  // Create tools
  const tools = [...createFileTools(config.toolContext), ...createAnalysisTools()];
  const llmWithTools = llm.bindTools(tools);

  // Node: Select next file to analyze
  async function selectNextFile(state: AnalyzerGraphState): Promise<Partial<AnalyzerGraphState>> {
    const { files, currentFileIndex, filesAnalyzed } = state;

    // Find next unanalyzed file
    let nextIndex = currentFileIndex;
    while (nextIndex < files.length && filesAnalyzed.includes(files[nextIndex].path)) {
      nextIndex++;
    }

    if (nextIndex >= files.length) {
      return {
        phase: 'complete' as const,
        shouldContinue: false,
      };
    }

    return {
      currentFileIndex: nextIndex,
      phase: 'analyzing' as const,
    };
  }

  // Node: Analyze current file
  async function analyzeFile(state: AnalyzerGraphState): Promise<Partial<AnalyzerGraphState>> {
    const { files, currentFileIndex, findings, filesAnalyzed, scanId } = state;
    const file = files[currentFileIndex];

    if (!file) {
      return {
        phase: 'selecting' as const,
        errors: [
          ...state.errors,
          {
            agent: 'analyzer' as const,
            message: `No file at index ${currentFileIndex}`,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
      };
    }

    try {
      // Truncate content if too large
      let content = file.content;
      const estimatedTokens = Math.ceil(content.length / 4);
      if (estimatedTokens > config.maxTokensPerFile) {
        const maxChars = config.maxTokensPerFile * 4;
        content = content.substring(0, maxChars) + '\n\n[Content truncated...]';
      }

      const userPrompt = `Analyze this ${file.language || 'code'} file for technical debt:

File: ${file.path}
\`\`\`${file.language || ''}
${content}
\`\`\`

Identify any technical debt issues. For each finding, use the report_debt tool.
After analyzing, provide a summary with:
- Overall assessment (1-2 sentences)
- File health score (0-100)`;

      const response = await llmWithTools.invoke([
        new SystemMessage(ANALYZER_SYSTEM_PROMPT),
        new HumanMessage(userPrompt),
      ]);

      // Parse tool calls from response
      const newFindings: DebtFinding[] = [];

      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const toolCall of response.tool_calls) {
          if (toolCall.name === 'report_debt') {
            const args = toolCall.args as Record<string, unknown>;
            newFindings.push({
              id: uuidv4(),
              debtType: args.debtType as DebtFinding['debtType'],
              severity: args.severity as DebtFinding['severity'],
              confidence: args.confidence as number,
              title: args.title as string,
              description: args.description as string,
              filePath: args.filePath as string,
              startLine: args.startLine as number | null,
              endLine: args.endLine as number | null,
              evidence: args.evidence as string[],
              suggestedFix: args.suggestedFix as string | null,
            });
          }
        }
      }

      return {
        findings: [...findings, ...newFindings],
        filesAnalyzed: [...filesAnalyzed, file.path],
        phase: 'selecting' as const,
      };
    } catch (error) {
      return {
        filesAnalyzed: [...filesAnalyzed, file.path],
        phase: 'selecting' as const,
        errors: [
          ...state.errors,
          {
            agent: 'analyzer' as const,
            message: `Error analyzing ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
      };
    }
  }

  // Node: Validate findings batch
  async function validateFindings(state: AnalyzerGraphState): Promise<Partial<AnalyzerGraphState>> {
    // Simple validation - remove duplicates and low-confidence findings
    const { findings } = state;

    const validated = findings.filter((f, index) => {
      // Remove duplicates (same file, same lines, same type)
      const isDuplicate = findings.findIndex(
        (other) =>
          other.filePath === f.filePath &&
          other.startLine === f.startLine &&
          other.endLine === f.endLine &&
          other.debtType === f.debtType,
      ) !== index;

      return !isDuplicate && f.confidence >= 0.5;
    });

    return {
      findings: validated,
      phase: 'complete' as const,
    };
  }

  // Routing function
  function shouldContinue(state: AnalyzerGraphState): string {
    if (!state.shouldContinue || state.phase === 'complete') {
      return 'end';
    }

    switch (state.phase) {
      case 'selecting':
        return 'selectNextFile';
      case 'analyzing':
        return 'analyzeFile';
      case 'validating':
        return 'validateFindings';
      default:
        return 'end';
    }
  }

  // Build the graph
  const graph = new StateGraph(AnalyzerStateAnnotation)
    .addNode('selectNextFile', selectNextFile)
    .addNode('analyzeFile', analyzeFile)
    .addNode('validateFindings', validateFindings)
    .addEdge('__start__', 'selectNextFile')
    .addConditionalEdges('selectNextFile', (state) => {
      if (state.phase === 'complete') return 'validateFindings';
      if (state.phase === 'analyzing') return 'analyzeFile';
      return '__end__';
    })
    .addEdge('analyzeFile', 'selectNextFile')
    .addEdge('validateFindings', '__end__');

  return graph.compile();
}

// Helper to run the analyzer
export async function runAnalyzer(
  config: AnalyzerConfig,
  input: {
    repositoryId: string;
    scanId: string;
    files: FileInfo[];
  },
): Promise<{
  findings: DebtFinding[];
  filesAnalyzed: string[];
  errors: AgentError[];
}> {
  const graph = createAnalyzerGraph(config);

  const initialState: AnalyzerGraphState = {
    repositoryId: input.repositoryId,
    scanId: input.scanId,
    files: input.files,
    currentFileIndex: 0,
    findings: [],
    filesAnalyzed: [],
    phase: 'selecting',
    errors: [],
    shouldContinue: true,
  };

  const result = await graph.invoke(initialState);

  return {
    findings: result.findings,
    filesAnalyzed: result.filesAnalyzed,
    errors: result.errors,
  };
}
