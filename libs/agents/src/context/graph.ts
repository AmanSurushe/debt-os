import { StateGraph, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ContextState, GitContext, AgentError } from '../types';
import { ToolContext, createGitTools } from '../tools';

// State annotation for LangGraph
const ContextStateAnnotation = Annotation.Root({
  repositoryId: Annotation<string>,
  scanId: Annotation<string>,
  targetFile: Annotation<string>,
  gitHistory: Annotation<GitContext[]>,
  relatedChanges: Annotation<GitContext[]>,
  contextReport: Annotation<string | null>,
  errors: Annotation<AgentError[]>,
  shouldContinue: Annotation<boolean>,
});

type ContextGraphState = typeof ContextStateAnnotation.State;

export interface ContextConfig {
  model: 'gpt-4o' | 'claude-3-5-sonnet-latest';
  openaiApiKey?: string;
  anthropicApiKey?: string;
  maxCommits: number;
  toolContext: ToolContext;
}

const CONTEXT_SYSTEM_PROMPT = `You are an expert at analyzing git history to understand code evolution.

Your task is to analyze the git history of a file to provide context about:
- When issues might have been introduced
- Who made significant changes
- Patterns of change over time
- Related files that changed together

Use the git_log, git_blame, and git_diff tools to gather information.
Focus on understanding the "why" behind code changes, not just the "what".`;

export function createContextGraph(config: ContextConfig) {
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
  const tools = createGitTools(config.toolContext);
  const llmWithTools = llm.bindTools(tools);

  // Node: Fetch git history for the file
  async function fetchGitHistory(state: ContextGraphState): Promise<Partial<ContextGraphState>> {
    const { targetFile } = state;

    try {
      const history = await config.toolContext.gitService.getLog(
        config.toolContext.repositoryId,
        { file: targetFile, limit: config.maxCommits },
      );

      return {
        gitHistory: history,
      };
    } catch (error) {
      return {
        gitHistory: [],
        errors: [
          ...state.errors,
          {
            agent: 'context' as const,
            message: `Error fetching git history: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
      };
    }
  }

  // Node: Analyze changes and find related commits
  async function analyzeChanges(state: ContextGraphState): Promise<Partial<ContextGraphState>> {
    const { targetFile, gitHistory } = state;

    if (gitHistory.length === 0) {
      return { relatedChanges: [] };
    }

    try {
      // Get the most significant commits (those with larger diffs)
      const significantCommits: GitContext[] = [];

      for (const commit of gitHistory.slice(0, 5)) {
        try {
          const diff = await config.toolContext.gitService.getDiff(
            config.toolContext.repositoryId,
            commit.commitSha,
          );

          // Check if this commit has substantial changes to our file
          if (diff.includes(targetFile) && diff.length > 100) {
            significantCommits.push(commit);
          }
        } catch {
          // Skip if diff fails
        }
      }

      return {
        relatedChanges: significantCommits,
      };
    } catch (error) {
      return {
        relatedChanges: [],
        errors: [
          ...state.errors,
          {
            agent: 'context' as const,
            message: `Error analyzing changes: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
      };
    }
  }

  // Node: Synthesize context report
  async function synthesizeContext(state: ContextGraphState): Promise<Partial<ContextGraphState>> {
    const { targetFile, gitHistory, relatedChanges } = state;

    if (gitHistory.length === 0) {
      return {
        contextReport: 'No git history available for this file.',
      };
    }

    try {
      const historyText = gitHistory
        .slice(0, 10)
        .map(
          (c) =>
            `- ${c.commitSha.substring(0, 7)}: ${c.message.split('\n')[0]} (${c.authorName}, ${c.date.toISOString().split('T')[0]})`,
        )
        .join('\n');

      const relatedText = relatedChanges
        .map((c) => `- ${c.commitSha.substring(0, 7)}: ${c.message.split('\n')[0]}`)
        .join('\n');

      const prompt = `Analyze the git history for file: ${targetFile}

Recent commits:
${historyText}

Significant changes:
${relatedText || 'None identified'}

Provide a brief context report (2-3 paragraphs) covering:
1. Evolution of this file over time
2. Key contributors and their focus areas
3. Any patterns suggesting technical debt accumulation
4. Recommendations for understanding this code better`;

      const response = await llm.invoke([
        new SystemMessage(CONTEXT_SYSTEM_PROMPT),
        new HumanMessage(prompt),
      ]);

      return {
        contextReport: response.content as string,
      };
    } catch (error) {
      return {
        contextReport: null,
        errors: [
          ...state.errors,
          {
            agent: 'context' as const,
            message: `Error synthesizing context: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
      };
    }
  }

  // Build the graph
  const graph = new StateGraph(ContextStateAnnotation)
    .addNode('fetchGitHistory', fetchGitHistory)
    .addNode('analyzeChanges', analyzeChanges)
    .addNode('synthesizeContext', synthesizeContext)
    .addEdge('__start__', 'fetchGitHistory')
    .addEdge('fetchGitHistory', 'analyzeChanges')
    .addEdge('analyzeChanges', 'synthesizeContext')
    .addEdge('synthesizeContext', '__end__');

  return graph.compile();
}

// Helper to run the context agent
export async function runContextAgent(
  config: ContextConfig,
  input: {
    repositoryId: string;
    scanId: string;
    targetFile: string;
  },
): Promise<{
  gitHistory: GitContext[];
  relatedChanges: GitContext[];
  contextReport: string | null;
  errors: AgentError[];
}> {
  const graph = createContextGraph(config);

  const initialState: ContextGraphState = {
    repositoryId: input.repositoryId,
    scanId: input.scanId,
    targetFile: input.targetFile,
    gitHistory: [],
    relatedChanges: [],
    contextReport: null,
    errors: [],
    shouldContinue: true,
  };

  const result = await graph.invoke(initialState);

  return {
    gitHistory: result.gitHistory,
    relatedChanges: result.relatedChanges,
    contextReport: result.contextReport,
    errors: result.errors,
  };
}
