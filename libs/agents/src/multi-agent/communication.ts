import { v4 as uuidv4 } from 'uuid';
import {
  AgentRole,
  AgentMessage,
  MessageType,
  MessageContent,
  MessageBus,
  MessageFilter,
} from './types';

/**
 * In-memory message bus for agent communication
 */
export class InMemoryMessageBus implements MessageBus {
  private messages: AgentMessage[] = [];
  private subscribers: Map<AgentRole, Array<(message: AgentMessage) => void>> = new Map();

  /**
   * Publish a message to the bus
   */
  publish(message: AgentMessage): void {
    this.messages.push(message);

    // Notify subscribers
    if (message.to === 'broadcast') {
      // Broadcast to all subscribers
      for (const [, callbacks] of this.subscribers) {
        for (const callback of callbacks) {
          callback(message);
        }
      }
    } else {
      // Direct message to specific agent
      const callbacks = this.subscribers.get(message.to) || [];
      for (const callback of callbacks) {
        callback(message);
      }
    }
  }

  /**
   * Subscribe to messages for a specific role
   */
  subscribe(role: AgentRole, callback: (message: AgentMessage) => void): void {
    const existing = this.subscribers.get(role) || [];
    existing.push(callback);
    this.subscribers.set(role, existing);
  }

  /**
   * Get messages with optional filtering
   */
  getMessages(filter?: MessageFilter): AgentMessage[] {
    if (!filter) return [...this.messages];

    return this.messages.filter((msg) => {
      if (filter.from && msg.from !== filter.from) return false;
      if (filter.to && msg.to !== filter.to) return false;
      if (filter.type && msg.type !== filter.type) return false;
      if (filter.afterTimestamp && msg.timestamp <= filter.afterTimestamp) return false;
      if (filter.relatedToFinding && msg.content.finding?.id !== filter.relatedToFinding) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get conversation thread for a finding
   */
  getThread(findingId: string): AgentMessage[] {
    return this.messages.filter(
      (msg) =>
        msg.content.finding?.id === findingId ||
        this.isInThread(msg, findingId),
    ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Check if a message is part of a thread
   */
  private isInThread(msg: AgentMessage, findingId: string): boolean {
    if (!msg.inReplyTo) return false;

    const parent = this.messages.find((m) => m.id === msg.inReplyTo);
    if (!parent) return false;

    if (parent.content.finding?.id === findingId) return true;
    return this.isInThread(parent, findingId);
  }

  /**
   * Clear all messages
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Get message count
   */
  get count(): number {
    return this.messages.length;
  }
}

/**
 * Helper functions for creating messages
 */
export function createFindingMessage(
  from: AgentRole,
  finding: import('../types').DebtFinding,
): AgentMessage {
  return {
    id: uuidv4(),
    from,
    to: 'broadcast',
    type: 'finding',
    content: {
      text: `Found ${finding.severity} ${finding.debtType}: ${finding.title}`,
      finding,
      confidence: finding.confidence,
    },
    timestamp: new Date(),
  };
}

export function createChallengeMessage(
  from: AgentRole,
  to: AgentRole,
  finding: import('../types').DebtFinding,
  reason: string,
  evidence?: string[],
): AgentMessage {
  return {
    id: uuidv4(),
    from,
    to,
    type: 'challenge',
    content: {
      text: reason,
      finding,
      evidence,
      confidence: 0,
    },
    timestamp: new Date(),
  };
}

export function createDefenseMessage(
  from: AgentRole,
  to: AgentRole,
  finding: import('../types').DebtFinding,
  defense: string,
  evidence: string[],
  inReplyTo: string,
): AgentMessage {
  return {
    id: uuidv4(),
    from,
    to,
    type: 'defend',
    content: {
      text: defense,
      finding,
      evidence,
    },
    timestamp: new Date(),
    inReplyTo,
  };
}

export function createConcedeMessage(
  from: AgentRole,
  to: AgentRole,
  finding: import('../types').DebtFinding,
  reason: string,
  inReplyTo: string,
): AgentMessage {
  return {
    id: uuidv4(),
    from,
    to,
    type: 'concede',
    content: {
      text: reason,
      finding,
    },
    timestamp: new Date(),
    inReplyTo,
  };
}

export function createVoteMessage(
  from: AgentRole,
  finding: import('../types').DebtFinding,
  vote: boolean,
  reason: string,
  inReplyTo?: string,
): AgentMessage {
  return {
    id: uuidv4(),
    from,
    to: 'broadcast',
    type: 'vote',
    content: {
      text: reason,
      finding,
      vote,
    },
    timestamp: new Date(),
    inReplyTo,
  };
}

export function createConsensusMessage(
  from: AgentRole,
  finding: import('../types').DebtFinding,
  proposal: string,
  adjustedConfidence: number,
): AgentMessage {
  return {
    id: uuidv4(),
    from,
    to: 'broadcast',
    type: 'consensus',
    content: {
      text: proposal,
      finding,
      confidence: adjustedConfidence,
    },
    timestamp: new Date(),
  };
}

/**
 * Create a new message bus instance
 */
export function createMessageBus(): MessageBus {
  return new InMemoryMessageBus();
}
