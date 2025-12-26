import { StateGraph, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
import { DebtFinding, FileInfo, AgentError } from '../../types';
import { AgentConfig } from '../types';
import { ToolContext, createFileTools, createAnalysisTools } from '../../tools';

// Scanner state
const ScannerStateAnnotation = Annotation.Root({
  files: Annotation<FileInfo[]>,
  currentFileIndex: Annotation<number>,
  findings: Annotation<DebtFinding[]>,
  errors: Annotation<AgentError[]>,
  isComplete: Annotation<boolean>,
});

type ScannerState = typeof ScannerStateAnnotation.State;

export interface ScannerAgentConfig {
  agentConfig: AgentConfig;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  toolContext: ToolContext;
  maxFilesPerBatch?: number;
}

export function createScannerAgent(config: ScannerAgentConfig) {
  const { agentConfig, toolContext } = config;
  const maxFilesPerBatch = config.maxFilesPerBatch || 5;

  // Initialize LLM based on config
  const llm = agentConfig.model.startsWith('gpt')
    ? new ChatOpenAI({
        modelName: agentConfig.model,
        temperature: agentConfig.temperature,
        maxTokens: agentConfig.maxTokens,
        openAIApiKey: config.openaiApiKey,
      })
    : new ChatAnthropic({
        modelName: agentConfig.model,
        temperature: agentConfig.temperature,
        maxTokens: agentConfig.maxTokens,
        anthropicApiKey: config.anthropicApiKey,
      });

  const tools = [...createFileTools(toolContext), ...createAnalysisTools()];
  const llmWithTools = llm.bindTools(tools);

  // Node: Analyze a batch of files
  async function analyzeBatch(state: ScannerState): Promise<Partial<ScannerState>> {
    const { files, currentFileIndex, findings, errors } = state;

    const endIndex = Math.min(currentFileIndex + maxFilesPerBatch, files.length);
    const batch = files.slice(currentFileIndex, endIndex);

    if (batch.length === 0) {
      return { isComplete: true };
    }

    const batchFindings: DebtFinding[] = [];
    const batchErrors: AgentError[] = [];

    for (const file of batch) {
      try {
        const fileFindings = await analyzeFile(file, llmWithTools, agentConfig.systemPrompt);
        batchFindings.push(...fileFindings);
      } catch (error) {
        batchErrors.push({
          agent: 'scanner',
          message: `Failed to analyze ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
          recoverable: true,
        });
      }
    }

    return {
      currentFileIndex: endIndex,
      findings: [...findings, ...batchFindings],
      errors: [...errors, ...batchErrors],
      isComplete: endIndex >= files.length,
    };
  }

  // Build graph
  const graph = new StateGraph(ScannerStateAnnotation)
    .addNode('analyzeBatch', analyzeBatch)
    .addEdge('__start__', 'analyzeBatch')
    .addConditionalEdges('analyzeBatch', (state) => {
      return state.isComplete ? '__end__' : 'analyzeBatch';
    });

  return graph.compile();
}

async function analyzeFile(
  file: FileInfo,
  llm: ReturnType<typeof ChatOpenAI.prototype.bindTools>,
  systemPrompt: string,
): Promise<DebtFinding[]> {
  const findings: DebtFinding[] = [];

  const userPrompt = `Analyze this ${file.language || 'code'} file for technical debt:

File: ${file.path}
Lines: ${file.lineCount}

\`\`\`${file.language || ''}
${file.content.slice(0, 8000)}
\`\`\`

Look for:
1. Code smells (long functions, deep nesting, magic numbers)
2. Complexity issues (cyclomatic complexity, too many parameters)
3. Potential bugs or anti-patterns
4. Security concerns (hardcoded values, injection risks)
5. Missing error handling

For each issue found, use the report_debt tool to record it.`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  // Extract findings from tool calls
  if (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      if (toolCall.name === 'report_debt') {
        const args = toolCall.args as Record<string, unknown>;
        findings.push({
          id: uuidv4(),
          debtType: args.debtType as string,
          severity: args.severity as DebtFinding['severity'],
          confidence: args.confidence as number,
          title: args.title as string,
          description: args.description as string,
          filePath: file.path,
          startLine: args.startLine as number | undefined,
          endLine: args.endLine as number | undefined,
          evidence: args.evidence as string[],
          suggestedFix: args.suggestedFix as string | undefined,
        });
      }
    }
  }

  return findings;
}

export async function runScannerAgent(
  config: ScannerAgentConfig,
  files: FileInfo[],
): Promise<{
  findings: DebtFinding[];
  errors: AgentError[];
}> {
  const graph = createScannerAgent(config);

  const initialState: ScannerState = {
    files,
    currentFileIndex: 0,
    findings: [],
    errors: [],
    isComplete: false,
  };

  const result = await graph.invoke(initialState);

  return {
    findings: result.findings,
    errors: result.errors,
  };
}
