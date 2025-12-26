import { v4 as uuidv4 } from 'uuid';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DebtFinding } from '../../types';
import {
  Debate,
  DebateResolution,
  DebateConfig,
  AgentRole,
  AgentMessage,
  ResolutionStrategy,
  getAgentWeights,
} from '../types';
import {
  createChallengeMessage,
  createDefenseMessage,
  createConcedeMessage,
  createVoteMessage,
  createConsensusMessage,
} from '../communication';

export const DEFAULT_DEBATE_CONFIG: DebateConfig = {
  maxRounds: 3,
  timeoutMs: 30000,
  resolutionStrategy: 'weighted',
  requireEvidenceForChallenge: true,
};

/**
 * Manages debates between agents about findings
 */
export class DebateManager {
  private debates: Map<string, Debate> = new Map();
  private config: DebateConfig;

  constructor(config?: Partial<DebateConfig>) {
    this.config = { ...DEFAULT_DEBATE_CONFIG, ...config };
  }

  /**
   * Start a new debate about a finding
   */
  startDebate(
    finding: DebtFinding,
    initiator: AgentRole,
    challenger: AgentRole,
    challengeReason: string,
    evidence?: string[],
  ): Debate {
    const debateId = uuidv4();

    const initialChallenge = createChallengeMessage(
      challenger,
      initiator,
      finding,
      challengeReason,
      evidence,
    );

    const debate: Debate = {
      id: debateId,
      topic: finding,
      initiator,
      challenger,
      messages: [initialChallenge],
      status: 'active',
      startedAt: new Date(),
    };

    this.debates.set(debateId, debate);
    return debate;
  }

  /**
   * Add a message to a debate
   */
  addMessage(debateId: string, message: AgentMessage): Debate | null {
    const debate = this.debates.get(debateId);
    if (!debate || debate.status !== 'active') return null;

    debate.messages.push(message);

    // Check if debate should end
    if (this.shouldEndDebate(debate)) {
      this.resolveDebate(debateId);
    }

    return debate;
  }

  /**
   * Check if a debate should end
   */
  private shouldEndDebate(debate: Debate): boolean {
    // End if someone conceded
    if (debate.messages.some((m) => m.type === 'concede')) {
      return true;
    }

    // End if max rounds reached
    const rounds = Math.floor(debate.messages.length / 2);
    if (rounds >= this.config.maxRounds) {
      return true;
    }

    // End if consensus proposed
    if (debate.messages.some((m) => m.type === 'consensus')) {
      return true;
    }

    return false;
  }

  /**
   * Resolve a debate based on configured strategy
   */
  resolveDebate(debateId: string): DebateResolution | null {
    const debate = this.debates.get(debateId);
    if (!debate) return null;

    const resolution = this.calculateResolution(debate);
    debate.resolution = resolution;
    debate.status = 'resolved';
    debate.resolvedAt = new Date();

    return resolution;
  }

  /**
   * Calculate resolution based on strategy
   */
  private calculateResolution(debate: Debate): DebateResolution {
    const { topic, messages } = debate;

    // Check for concession
    const concession = messages.find((m) => m.type === 'concede');
    if (concession) {
      const concedingParty = concession.from;
      const accepted = concedingParty === debate.challenger; // If critic concedes, finding is accepted

      return {
        accepted,
        reason: `${concedingParty} conceded: ${concession.content.text}`,
        votes: { [concedingParty]: !accepted } as Record<AgentRole, boolean>,
        finalConfidence: accepted ? topic.confidence : 0,
      };
    }

    // Check for consensus
    const consensus = messages.find((m) => m.type === 'consensus');
    if (consensus) {
      return {
        accepted: true,
        reason: `Consensus reached: ${consensus.content.text}`,
        votes: {} as Record<AgentRole, boolean>,
        finalConfidence: consensus.content.confidence || topic.confidence,
      };
    }

    // Collect votes
    const votes = this.collectVotes(messages);

    // Apply resolution strategy
    const accepted = this.applyResolutionStrategy(votes, topic);

    // Calculate final confidence
    const voteValues = Object.values(votes);
    const yesVotes = voteValues.filter((v) => v).length;
    const finalConfidence = (yesVotes / Math.max(voteValues.length, 1)) * topic.confidence;

    return {
      accepted,
      reason: this.generateResolutionReason(debate, accepted),
      votes,
      finalConfidence,
    };
  }

  /**
   * Collect votes from debate messages
   */
  private collectVotes(messages: AgentMessage[]): Record<AgentRole, boolean> {
    const votes: Partial<Record<AgentRole, boolean>> = {};

    for (const message of messages) {
      if (message.type === 'vote') {
        votes[message.from] = message.content.vote || false;
      } else if (message.type === 'defend') {
        votes[message.from] = true; // Defense implies support
      } else if (message.type === 'challenge') {
        votes[message.from] = false; // Challenge implies opposition
      }
    }

    return votes as Record<AgentRole, boolean>;
  }

  /**
   * Apply the configured resolution strategy
   */
  private applyResolutionStrategy(
    votes: Record<AgentRole, boolean>,
    topic: DebtFinding,
  ): boolean {
    switch (this.config.resolutionStrategy) {
      case 'majority':
        return this.majorityVote(votes);

      case 'weighted':
        return this.weightedVote(votes, topic);

      case 'conservative':
        return this.conservativeVote(votes);

      case 'unanimous':
        return this.unanimousVote(votes);

      default:
        return this.majorityVote(votes);
    }
  }

  /**
   * Simple majority vote
   */
  private majorityVote(votes: Record<AgentRole, boolean>): boolean {
    const voteValues = Object.values(votes);
    const yesVotes = voteValues.filter((v) => v).length;
    return yesVotes > voteValues.length / 2;
  }

  /**
   * Weighted vote based on agent expertise
   */
  private weightedVote(votes: Record<AgentRole, boolean>, topic: DebtFinding): boolean {
    const weights = getAgentWeights(topic.debtType);
    let score = 0;

    for (const [agent, vote] of Object.entries(votes)) {
      const weight = weights[agent as AgentRole] || 0.1;
      score += vote ? weight : -weight;
    }

    return score > 0;
  }

  /**
   * Conservative: any critic rejection = rejected
   */
  private conservativeVote(votes: Record<AgentRole, boolean>): boolean {
    if ('critic' in votes) {
      return votes.critic;
    }
    return this.majorityVote(votes);
  }

  /**
   * Unanimous: all must agree
   */
  private unanimousVote(votes: Record<AgentRole, boolean>): boolean {
    return Object.values(votes).every((v) => v);
  }

  /**
   * Generate a human-readable resolution reason
   */
  private generateResolutionReason(debate: Debate, accepted: boolean): string {
    const { messages } = debate;

    if (accepted) {
      const defenses = messages.filter((m) => m.type === 'defend');
      if (defenses.length > 0) {
        return `Finding accepted after successful defense. Key points: ${defenses[0].content.text.slice(0, 200)}`;
      }
      return 'Finding accepted based on voting results.';
    } else {
      const challenges = messages.filter((m) => m.type === 'challenge');
      if (challenges.length > 0) {
        return `Finding rejected. Reason: ${challenges[0].content.text.slice(0, 200)}`;
      }
      return 'Finding rejected based on voting results.';
    }
  }

  /**
   * Get all debates
   */
  getDebates(): Debate[] {
    return Array.from(this.debates.values());
  }

  /**
   * Get active debates
   */
  getActiveDebates(): Debate[] {
    return this.getDebates().filter((d) => d.status === 'active');
  }

  /**
   * Get debate by ID
   */
  getDebate(debateId: string): Debate | undefined {
    return this.debates.get(debateId);
  }

  /**
   * Escalate a debate that can't be resolved
   */
  escalateDebate(debateId: string, reason: string): void {
    const debate = this.debates.get(debateId);
    if (debate) {
      debate.status = 'escalated';
      debate.messages.push({
        id: uuidv4(),
        from: 'critic', // Usually critic escalates
        to: 'broadcast',
        type: 'escalate',
        content: { text: reason },
        timestamp: new Date(),
      });
    }
  }
}

/**
 * LLM-assisted debate resolution for complex cases
 */
export async function resolveWithArbiter(
  debate: Debate,
  llm: ChatOpenAI | ChatAnthropic,
): Promise<DebateResolution> {
  const prompt = buildArbiterPrompt(debate);

  const response = await llm.invoke([
    new SystemMessage(`You are a neutral arbiter resolving a debate between AI agents about a technical debt finding.
Your role is to:
1. Consider all arguments objectively
2. Weigh the evidence presented
3. Make a fair decision
4. Provide clear reasoning

Output your decision in JSON format:
{
  "accepted": boolean,
  "reason": "string explaining your decision",
  "adjustedConfidence": number between 0 and 1,
  "adjustedSeverity": "optional: critical|high|medium|low|info"
}`),
    new HumanMessage(prompt),
  ]);

  try {
    const content = response.content as string;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const decision = JSON.parse(jsonMatch[0]);
      return {
        accepted: decision.accepted,
        reason: decision.reason,
        votes: {} as Record<AgentRole, boolean>,
        finalConfidence: decision.adjustedConfidence,
        adjustedSeverity: decision.adjustedSeverity,
      };
    }
  } catch {
    // Parsing failed
  }

  // Default: accept with reduced confidence
  return {
    accepted: true,
    reason: 'Arbiter could not make a clear decision. Accepting with reduced confidence.',
    votes: {} as Record<AgentRole, boolean>,
    finalConfidence: debate.topic.confidence * 0.7,
  };
}

function buildArbiterPrompt(debate: Debate): string {
  const lines: string[] = [
    '# Debate to Resolve',
    '',
    '## Finding in Question',
    `- Type: ${debate.topic.debtType}`,
    `- Severity: ${debate.topic.severity}`,
    `- Title: ${debate.topic.title}`,
    `- Description: ${debate.topic.description}`,
    `- File: ${debate.topic.filePath}`,
    `- Original Confidence: ${debate.topic.confidence}`,
    '',
    '## Debate Transcript',
    '',
  ];

  for (const msg of debate.messages) {
    lines.push(`### ${msg.from.toUpperCase()} (${msg.type})`);
    lines.push(msg.content.text);
    if (msg.content.evidence && msg.content.evidence.length > 0) {
      lines.push('Evidence:');
      for (const e of msg.content.evidence) {
        lines.push(`- ${e}`);
      }
    }
    lines.push('');
  }

  lines.push('## Your Decision');
  lines.push('Should this finding be accepted or rejected? Provide your reasoning.');

  return lines.join('\n');
}

export function createDebateManager(config?: Partial<DebateConfig>): DebateManager {
  return new DebateManager(config);
}
