// Types
export * from './types';

// Providers
export { OpenAIProvider } from './openai.provider';
export { AnthropicProvider } from './anthropic.provider';

// Models
export {
  MODEL_CONFIGS,
  selectModelForTask,
  getModelConfig,
  getModelsByProvider,
  calculateCost,
  modelSupportsFeature,
} from './models';

// Budget
export {
  TASK_BUDGETS,
  getBudgetForTask,
  fitsWithinBudget,
  getAvailableTokens,
  estimateTokens,
  estimateCodeTokens,
  validateModelCapacity,
  calculateChunkSize,
  splitIntoChunks,
  estimateCost,
  createBudgetReport,
} from './budget';

// Prompts
export { templateEngine, TemplateEngine } from './prompts/template-engine';
export {
  DebtFindingSchema,
  FILE_ANALYSIS_TEMPLATE,
  ARCHITECTURE_ANALYSIS_TEMPLATE,
  REMEDIATION_TEMPLATE,
  CODE_REVIEW_TEMPLATE,
  SUMMARIZATION_TEMPLATE,
  PROMPT_TEMPLATES,
  getPromptTemplate,
} from './prompts/debt-analysis';
export type { DebtFinding, PromptTemplateName } from './prompts/debt-analysis';

// Utilities
export { zodToJsonSchema } from './utils/zod-to-json';

// Client
export { LLMClient, createLLMClient } from './llm-client';
