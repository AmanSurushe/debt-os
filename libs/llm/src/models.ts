import { ModelConfig, AnalysisTaskType } from './types';

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gpt-4o-mini': {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    bestFor: ['classification', 'simple-extraction', 'summarization'],
    supportsTools: true,
    supportsVision: true,
    supportsStructuredOutput: true,
  },
  'gpt-4o': {
    provider: 'openai',
    modelId: 'gpt-4o',
    displayName: 'GPT-4o',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
    bestFor: ['code-analysis', 'reasoning', 'debt-detection'],
    supportsTools: true,
    supportsVision: true,
    supportsStructuredOutput: true,
  },
  'claude-3-5-haiku-latest': {
    provider: 'anthropic',
    modelId: 'claude-3-5-haiku-latest',
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    bestFor: ['classification', 'quick-analysis'],
    supportsTools: true,
    supportsVision: true,
    supportsStructuredOutput: true,
  },
  'claude-3-5-sonnet-latest': {
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-latest',
    displayName: 'Claude 3.5 Sonnet',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    bestFor: ['architecture', 'complex-reasoning', 'code-analysis'],
    supportsTools: true,
    supportsVision: true,
    supportsStructuredOutput: true,
  },
  'claude-opus-4-20250514': {
    provider: 'anthropic',
    modelId: 'claude-opus-4-20250514',
    displayName: 'Claude Opus 4',
    contextWindow: 200000,
    maxOutputTokens: 32768,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    bestFor: ['deep-analysis', 'planning', 'remediation'],
    supportsTools: true,
    supportsVision: true,
    supportsStructuredOutput: true,
  },
};

const TASK_MODEL_MAPPING: Record<AnalysisTaskType, string> = {
  'file-classification': 'gpt-4o-mini',
  'debt-detection': 'gpt-4o',
  'architecture-analysis': 'claude-3-5-sonnet-latest',
  'remediation-planning': 'claude-opus-4-20250514',
  'code-review': 'gpt-4o',
  'summarization': 'gpt-4o-mini',
};

export function selectModelForTask(taskType: AnalysisTaskType): string {
  return TASK_MODEL_MAPPING[taskType];
}

export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODEL_CONFIGS[modelId];
}

export function getModelsByProvider(provider: 'openai' | 'anthropic'): ModelConfig[] {
  return Object.values(MODEL_CONFIGS).filter((m) => m.provider === provider);
}

export function calculateCost(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const config = MODEL_CONFIGS[modelId];
  if (!config) return 0;
  return (promptTokens / 1000) * config.costPer1kInput +
         (completionTokens / 1000) * config.costPer1kOutput;
}

export function modelSupportsFeature(
  modelId: string,
  feature: 'tools' | 'vision' | 'structuredOutput',
): boolean {
  const config = MODEL_CONFIGS[modelId];
  if (!config) return false;
  switch (feature) {
    case 'tools': return config.supportsTools;
    case 'vision': return config.supportsVision;
    case 'structuredOutput': return config.supportsStructuredOutput;
    default: return false;
  }
}
