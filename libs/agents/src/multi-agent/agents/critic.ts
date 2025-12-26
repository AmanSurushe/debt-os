import { StateGraph, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
import { DebtFinding, AgentError } from '../../types';
import { AgentConfig, CriticReview, AgentMessage } from '../types';
import { ToolContext, createFileTools, createReflectionTools } from '../../tools';

// Critic state
const CriticStateAnnotation = Annotation.Root({
  findings: Annotation<DebtFinding[]>,
  currentIndex: Annotation<number>,
  reviews: Annotation<CriticReview[]>,
  challenges: Annotation<AgentMessage[]>,
  errors: Annotation<AgentError[]>,
  isComplete: Annotation<boolean>,
});

type CriticState = typeof CriticStateAnnotation.State;

export interface CriticAgentConfig {
  agentConfig: AgentConfig;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  toolContext: ToolContext;
  challengeThreshold?: number; // Confidence below this triggers challenge
}

export function createCriticAgent(config: CriticAgentConfig) {
  const { agentConfig, toolContext } = config;
  const challengeThreshold = config.challengeThreshold || 0.7;

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

  const tools = [...createFileTools(toolContext), ...createReflectionTools()];
  const llmWithTools = llm.bindTools(tools);

  // Node: Review next finding
  async function reviewFinding(state: CriticState): Promise<Partial<CriticState>> {
    const { findings, currentIndex, reviews, challenges, errors } = state;

    if (currentIndex >= findings.length) {
      return { isComplete: true };
    }

    const finding = findings[currentIndex];

    try {
      const review = await performReview(
        finding,
        llmWithTools,
        agentConfig.systemPrompt,
        challengeThreshold,
      );

      const newReviews = [...reviews, review];
      const newChallenges = [...challenges];

      // If not accepted, create a challenge message
      if (!review.accepted) {
        newChallenges.push({
          id: uuidv4(),
          from: 'critic',
          to: 'broadcast',
          type: 'challenge',
          content: {
            text: review.reason,
            finding,
            confidence: review.confidence,
          },
          timestamp: new Date(),
        });
      }

      return {
        currentIndex: currentIndex + 1,
        reviews: newReviews,
        challenges: newChallenges,
      };
    } catch (error) {
      // On error, accept the finding with a note
      return {
        currentIndex: currentIndex + 1,
        reviews: [
          ...reviews,
          {
            findingId: finding.id,
            accepted: true,
            confidence: finding.confidence,
            reason: 'Review failed, accepting original finding',
          },
        ],
        errors: [
          ...errors,
          {
            agent: 'critic',
            message: `Failed to review finding ${finding.id}: ${error instanceof Error ? error.message : 'Unknown'}`,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
      };
    }
  }

  // Build graph
  const graph = new StateGraph(CriticStateAnnotation)
    .addNode('reviewFinding', reviewFinding)
    .addEdge('__start__', 'reviewFinding')
    .addConditionalEdges('reviewFinding', (state) => {
      return state.isComplete ? '__end__' : 'reviewFinding';
    });

  return graph.compile();
}

async function performReview(
  finding: DebtFinding,
  llm: ReturnType<typeof ChatOpenAI.prototype.bindTools>,
  systemPrompt: string,
  challengeThreshold: number,
): Promise<CriticReview> {
  const userPrompt = `Review this technical debt finding and determine if it's valid:

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

Your task:
1. Use read_file to examine the actual code
2. Verify the finding is accurate
3. Check if there might be valid reasons for the code
4. Assess if the severity is appropriate

Then use either:
- validate_finding if you accept it (with adjusted confidence if needed)
- reject_finding if you believe it's a false positive

Be skeptical but fair. Don't reject valid findings, but also don't accept false positives.`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  // Default review (accept with original confidence)
  let review: CriticReview = {
    findingId: finding.id,
    accepted: true,
    confidence: finding.confidence,
    reason: 'No explicit validation provided',
  };

  // Process tool calls
  if (response.tool_calls && response.tool_calls.length > 0) {
    for (const toolCall of response.tool_calls) {
      if (toolCall.name === 'validate_finding') {
        const args = toolCall.args as Record<string, unknown>;
        const isValid = args.isValid as boolean;
        const adjustedConfidence = args.adjustedConfidence as number;

        review = {
          findingId: finding.id,
          accepted: isValid && adjustedConfidence >= challengeThreshold,
          confidence: adjustedConfidence,
          reason: args.reason as string || 'Validated by critic',
          suggestedAdjustments: isValid ? undefined : {
            severity: args.suggestedSeverity as string | undefined,
          },
        };
      } else if (toolCall.name === 'reject_finding') {
        const args = toolCall.args as Record<string, unknown>;
        review = {
          findingId: finding.id,
          accepted: false,
          confidence: 0,
          reason: args.reason as string || 'Rejected by critic',
        };
      }
    }
  }

  return review;
}

// Specialized functions for debate participation

export async function defendFinding(
  finding: DebtFinding,
  challenge: AgentMessage,
  llm: ReturnType<typeof ChatOpenAI.prototype.bindTools>,
  systemPrompt: string,
): Promise<AgentMessage> {
  const userPrompt = `A critic has challenged your finding. Defend it if you believe it's valid.

Original Finding:
- Title: ${finding.title}
- Type: ${finding.debtType}
- Severity: ${finding.severity}
- Description: ${finding.description}

Challenge from Critic:
"${challenge.content.text}"

Your options:
1. Provide additional evidence to support your finding
2. Concede if the critic makes valid points
3. Propose adjustments (e.g., lower severity)

Respond with your defense or concession.`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  const content = response.content as string;

  // Determine if defending or conceding
  const isConceding = content.toLowerCase().includes('concede') ||
                      content.toLowerCase().includes('agree with') ||
                      content.toLowerCase().includes('valid point');

  return {
    id: uuidv4(),
    from: 'scanner', // or whoever originated the finding
    to: 'critic',
    type: isConceding ? 'concede' : 'defend',
    content: {
      text: content,
      finding,
      evidence: [], // Could extract from LLM response
    },
    timestamp: new Date(),
    inReplyTo: challenge.id,
  };
}

export async function runCriticAgent(
  config: CriticAgentConfig,
  findings: DebtFinding[],
): Promise<{
  reviews: CriticReview[];
  challenges: AgentMessage[];
  errors: AgentError[];
}> {
  const graph = createCriticAgent(config);

  const initialState: CriticState = {
    findings,
    currentIndex: 0,
    reviews: [],
    challenges: [],
    errors: [],
    isComplete: false,
  };

  const result = await graph.invoke(initialState);

  return {
    reviews: result.reviews,
    challenges: result.challenges,
    errors: result.errors,
  };
}
