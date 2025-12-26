import { StateGraph, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
import {
  ReflectionState,
  DebtFinding,
  AgentError,
  ReflectionResultSchema,
} from '../types';
import { ToolContext, createFileTools, createReflectionTools } from '../tools';

// State annotation for LangGraph
const ReflectionStateAnnotation = Annotation.Root({
  repositoryId: Annotation<string>,
  scanId: Annotation<string>,
  findings: Annotation<DebtFinding[]>,
  validatedFindings: Annotation<DebtFinding[]>,
  rejectedFindings: Annotation<Array<{ finding: DebtFinding; reason: string }>>,
  confidenceAdjustments: Annotation<Record<string, number>>,
  currentFindingIndex: Annotation<number>,
  errors: Annotation<AgentError[]>,
  shouldContinue: Annotation<boolean>,
});

type ReflectionGraphState = typeof ReflectionStateAnnotation.State;

export interface ReflectionConfig {
  model: 'gpt-4o' | 'claude-3-5-sonnet-latest';
  openaiApiKey?: string;
  anthropicApiKey?: string;
  confidenceThreshold: number;
  toolContext: ToolContext;
}

const REFLECTION_SYSTEM_PROMPT = `You are a senior code reviewer validating technical debt findings.

Your task is to critically evaluate each finding and determine if it is:
1. A true positive - a genuine technical debt issue
2. A false positive - not actually an issue or acceptable in context

For each finding, consider:
- Is the issue real and accurately described?
- Is the code actually problematic, or is it appropriate for the context?
- Could there be good reasons for the code being written this way?
- Is the severity appropriate?
- Is the suggested fix practical?

Be skeptical but fair. Some findings that look like issues may actually be:
- Intentional design decisions with good reasons
- Temporary workarounds with existing tickets
- Acceptable trade-offs in the current context
- Language idioms that look unusual but are correct

You have access to the codebase to verify findings. Use the read_file tool to examine the actual code.

Output your validation decision with:
- isValid: true if the finding should be kept
- adjustedConfidence: your confidence in the finding (0.0-1.0)
- reason: brief explanation of your decision`;

export function createReflectionGraph(config: ReflectionConfig) {
  // Initialize LLM
  const llm = config.model.startsWith('gpt')
    ? new ChatOpenAI({
        modelName: config.model,
        temperature: 0.2, // Lower temperature for more consistent validation
        openAIApiKey: config.openaiApiKey,
      })
    : new ChatAnthropic({
        modelName: config.model,
        temperature: 0.2,
        anthropicApiKey: config.anthropicApiKey,
      });

  // Create tools for verification
  const tools = [...createFileTools(config.toolContext), ...createReflectionTools()];
  const llmWithTools = llm.bindTools(tools);

  // Node: Select next finding to validate
  async function selectNextFinding(state: ReflectionGraphState): Promise<Partial<ReflectionGraphState>> {
    const { findings, currentFindingIndex, validatedFindings, rejectedFindings } = state;

    // Find next finding that hasn't been processed
    const processedIds = new Set([
      ...validatedFindings.map((f) => f.id),
      ...rejectedFindings.map((r) => r.finding.id),
    ]);

    let nextIndex = currentFindingIndex;
    while (nextIndex < findings.length && processedIds.has(findings[nextIndex].id)) {
      nextIndex++;
    }

    if (nextIndex >= findings.length) {
      return {
        shouldContinue: false,
      };
    }

    return {
      currentFindingIndex: nextIndex,
    };
  }

  // Node: Validate current finding
  async function validateFinding(state: ReflectionGraphState): Promise<Partial<ReflectionGraphState>> {
    const {
      findings,
      currentFindingIndex,
      validatedFindings,
      rejectedFindings,
      confidenceAdjustments,
    } = state;

    const finding = findings[currentFindingIndex];
    if (!finding) {
      return {
        errors: [
          ...state.errors,
          {
            agent: 'reflection' as const,
            message: `No finding at index ${currentFindingIndex}`,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
      };
    }

    try {
      const userPrompt = `Validate this technical debt finding:

Finding ID: ${finding.id}
Type: ${finding.debtType}
Severity: ${finding.severity}
Confidence: ${finding.confidence}

Title: ${finding.title}
Description: ${finding.description}

File: ${finding.filePath}
Lines: ${finding.startLine || 'N/A'} - ${finding.endLine || 'N/A'}

Evidence:
${finding.evidence.map((e) => `- ${e}`).join('\n')}

Suggested Fix: ${finding.suggestedFix || 'None provided'}

Please:
1. Use the read_file tool to examine the actual code at the specified location
2. Evaluate if this finding is valid
3. Provide your assessment using the validate_finding or reject_finding tool`;

      const response = await llmWithTools.invoke([
        new SystemMessage(REFLECTION_SYSTEM_PROMPT),
        new HumanMessage(userPrompt),
      ]);

      // Process tool calls
      let isValidated = true;
      let adjustedConfidence = finding.confidence;
      let rejectionReason = '';

      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const toolCall of response.tool_calls) {
          if (toolCall.name === 'validate_finding') {
            const args = toolCall.args as Record<string, unknown>;
            isValidated = args.isValid as boolean;
            adjustedConfidence = args.adjustedConfidence as number;
          } else if (toolCall.name === 'reject_finding') {
            const args = toolCall.args as Record<string, unknown>;
            isValidated = false;
            rejectionReason = args.reason as string;
          }
        }
      }

      if (isValidated && adjustedConfidence >= config.confidenceThreshold) {
        const validatedFinding = {
          ...finding,
          confidence: adjustedConfidence,
        };
        return {
          validatedFindings: [...validatedFindings, validatedFinding],
          confidenceAdjustments: {
            ...confidenceAdjustments,
            [finding.id]: adjustedConfidence,
          },
        };
      } else {
        return {
          rejectedFindings: [
            ...rejectedFindings,
            {
              finding,
              reason: rejectionReason || `Confidence ${adjustedConfidence} below threshold ${config.confidenceThreshold}`,
            },
          ],
        };
      }
    } catch (error) {
      // On error, keep the finding with original confidence
      return {
        validatedFindings: [...validatedFindings, finding],
        errors: [
          ...state.errors,
          {
            agent: 'reflection' as const,
            message: `Error validating finding ${finding.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
      };
    }
  }

  // Node: Aggregate and finalize results
  async function finalizeResults(state: ReflectionGraphState): Promise<Partial<ReflectionGraphState>> {
    const { validatedFindings, rejectedFindings } = state;

    // Sort validated findings by severity and confidence
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const sortedFindings = [...validatedFindings].sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });

    return {
      validatedFindings: sortedFindings,
    };
  }

  // Build the graph
  const graph = new StateGraph(ReflectionStateAnnotation)
    .addNode('selectNextFinding', selectNextFinding)
    .addNode('validateFinding', validateFinding)
    .addNode('finalizeResults', finalizeResults)
    .addEdge('__start__', 'selectNextFinding')
    .addConditionalEdges('selectNextFinding', (state) => {
      if (!state.shouldContinue) return 'finalizeResults';
      return 'validateFinding';
    })
    .addEdge('validateFinding', 'selectNextFinding')
    .addEdge('finalizeResults', '__end__');

  return graph.compile();
}

// Helper to run the reflection agent
export async function runReflectionAgent(
  config: ReflectionConfig,
  input: {
    repositoryId: string;
    scanId: string;
    findings: DebtFinding[];
  },
): Promise<{
  validatedFindings: DebtFinding[];
  rejectedFindings: Array<{ finding: DebtFinding; reason: string }>;
  confidenceAdjustments: Record<string, number>;
  errors: AgentError[];
}> {
  const graph = createReflectionGraph(config);

  const initialState: ReflectionGraphState = {
    repositoryId: input.repositoryId,
    scanId: input.scanId,
    findings: input.findings,
    validatedFindings: [],
    rejectedFindings: [],
    confidenceAdjustments: {},
    currentFindingIndex: 0,
    errors: [],
    shouldContinue: true,
  };

  const result = await graph.invoke(initialState);

  return {
    validatedFindings: result.validatedFindings,
    rejectedFindings: result.rejectedFindings,
    confidenceAdjustments: result.confidenceAdjustments,
    errors: result.errors,
  };
}
