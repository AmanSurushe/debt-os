import { TokenBudget, AnalysisTaskType } from './types';
import { getModelConfig } from './models';

// Predefined budgets for different analysis tasks
export const TASK_BUDGETS: Record<AnalysisTaskType, TokenBudget> = {
  'file-classification': {
    maxInputTokens: 4000,
    maxOutputTokens: 500,
    reserveForTools: 200,
    reserveForContext: 500,
  },
  'debt-detection': {
    maxInputTokens: 8000,
    maxOutputTokens: 2000,
    reserveForTools: 500,
    reserveForContext: 1500,
  },
  'architecture-analysis': {
    maxInputTokens: 32000,
    maxOutputTokens: 4000,
    reserveForTools: 1000,
    reserveForContext: 4000,
  },
  'remediation-planning': {
    maxInputTokens: 16000,
    maxOutputTokens: 4000,
    reserveForTools: 500,
    reserveForContext: 2000,
  },
  'code-review': {
    maxInputTokens: 16000,
    maxOutputTokens: 2000,
    reserveForTools: 500,
    reserveForContext: 2000,
  },
  'summarization': {
    maxInputTokens: 8000,
    maxOutputTokens: 1000,
    reserveForTools: 200,
    reserveForContext: 500,
  },
};

/**
 * Get token budget for a specific task type
 */
export function getBudgetForTask(taskType: AnalysisTaskType): TokenBudget {
  return TASK_BUDGETS[taskType];
}

/**
 * Check if content fits within a token budget
 */
export function fitsWithinBudget(
  contentTokens: number,
  budget: TokenBudget,
): boolean {
  const availableTokens =
    budget.maxInputTokens - budget.reserveForTools - budget.reserveForContext;
  return contentTokens <= availableTokens;
}

/**
 * Calculate available tokens for content given a budget
 */
export function getAvailableTokens(budget: TokenBudget): number {
  return budget.maxInputTokens - budget.reserveForTools - budget.reserveForContext;
}

/**
 * Estimate tokens for text (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for code
  // This is a simplification; for production use tiktoken
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for code (slightly different ratio)
 */
export function estimateCodeTokens(code: string): number {
  // Code typically has more tokens per character due to syntax
  return Math.ceil(code.length / 3.5);
}

/**
 * Validate that a model can handle the required tokens
 */
export function validateModelCapacity(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): { valid: boolean; error?: string } {
  const config = getModelConfig(modelId);

  if (!config) {
    return { valid: false, error: `Unknown model: ${modelId}` };
  }

  const totalRequired = inputTokens + outputTokens;

  if (totalRequired > config.contextWindow) {
    return {
      valid: false,
      error: `Total tokens (${totalRequired}) exceeds model context window (${config.contextWindow})`,
    };
  }

  if (outputTokens > config.maxOutputTokens) {
    return {
      valid: false,
      error: `Output tokens (${outputTokens}) exceeds model max output (${config.maxOutputTokens})`,
    };
  }

  return { valid: true };
}

/**
 * Calculate optimal chunk size for processing large content
 */
export function calculateChunkSize(
  totalTokens: number,
  budget: TokenBudget,
): { chunkSize: number; chunkCount: number } {
  const availableTokens = getAvailableTokens(budget);

  if (totalTokens <= availableTokens) {
    return { chunkSize: totalTokens, chunkCount: 1 };
  }

  // Calculate number of chunks needed
  const chunkCount = Math.ceil(totalTokens / availableTokens);

  // Adjust chunk size to be slightly smaller to account for overlap
  const overlapTokens = Math.min(200, Math.floor(availableTokens * 0.1));
  const effectiveChunkSize = availableTokens - overlapTokens;

  return {
    chunkSize: effectiveChunkSize,
    chunkCount: Math.ceil(totalTokens / effectiveChunkSize),
  };
}

/**
 * Split content into chunks based on token budget
 */
export function splitIntoChunks(
  content: string,
  budget: TokenBudget,
): string[] {
  const totalTokens = estimateTokens(content);
  const { chunkSize, chunkCount } = calculateChunkSize(totalTokens, budget);

  if (chunkCount === 1) {
    return [content];
  }

  const lines = content.split('\n');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;
  const overlapLines = 5; // Keep some context between chunks

  for (let i = 0; i < lines.length; i++) {
    const lineTokens = estimateTokens(lines[i]);

    if (currentTokens + lineTokens > chunkSize && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.join('\n'));

      // Start new chunk with overlap
      const overlapStart = Math.max(0, currentChunk.length - overlapLines);
      currentChunk = currentChunk.slice(overlapStart);
      currentTokens = estimateTokens(currentChunk.join('\n'));
    }

    currentChunk.push(lines[i]);
    currentTokens += lineTokens;
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks;
}

/**
 * Calculate cost estimate for a task
 */
export function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const config = getModelConfig(modelId);
  if (!config) return 0;

  const inputCost = (inputTokens / 1000) * config.costPer1kInput;
  const outputCost = (outputTokens / 1000) * config.costPer1kOutput;

  return inputCost + outputCost;
}

/**
 * Create a budget report for a task
 */
export function createBudgetReport(
  taskType: AnalysisTaskType,
  actualInputTokens: number,
  actualOutputTokens: number,
  modelId: string,
): {
  budget: TokenBudget;
  actual: { input: number; output: number };
  utilization: { input: number; output: number };
  cost: number;
  withinBudget: boolean;
} {
  const budget = getBudgetForTask(taskType);
  const cost = estimateCost(modelId, actualInputTokens, actualOutputTokens);

  return {
    budget,
    actual: {
      input: actualInputTokens,
      output: actualOutputTokens,
    },
    utilization: {
      input: actualInputTokens / budget.maxInputTokens,
      output: actualOutputTokens / budget.maxOutputTokens,
    },
    cost,
    withinBudget:
      actualInputTokens <= budget.maxInputTokens &&
      actualOutputTokens <= budget.maxOutputTokens,
  };
}
