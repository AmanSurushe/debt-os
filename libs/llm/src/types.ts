import { z } from 'zod';

export type ProviderName = 'openai' | 'anthropic';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema<unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface CompletionRequest {
  model: string;
  systemPrompt?: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'required' | 'none' | { name: string };
  responseFormat?: 'text' | 'json';
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  totalCost: number;
}

export interface CompletionResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  model: string;
}

export interface StreamChunk {
  content?: string;
  toolCall?: Partial<ToolCall>;
  finishReason?: CompletionResponse['finishReason'];
}

export interface LLMProvider {
  readonly name: ProviderName;

  complete(request: CompletionRequest): Promise<CompletionResponse>;

  completeStructured<T>(
    request: CompletionRequest,
    schema: z.ZodSchema<T>,
  ): Promise<T>;

  stream(request: CompletionRequest): AsyncIterable<StreamChunk>;

  countTokens(text: string, model?: string): number;
}

export interface ModelConfig {
  provider: ProviderName;
  modelId: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  bestFor: string[];
  supportsTools: boolean;
  supportsVision: boolean;
  supportsStructuredOutput: boolean;
}

export interface TokenBudget {
  maxInputTokens: number;
  maxOutputTokens: number;
  reserveForTools: number;
  reserveForContext: number;
}

export interface PromptTemplate {
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  outputSchema?: z.ZodSchema<unknown>;
  tokenBudget?: TokenBudget;
}

export type AnalysisTaskType =
  | 'file-classification'
  | 'debt-detection'
  | 'architecture-analysis'
  | 'remediation-planning'
  | 'code-review'
  | 'summarization';

export interface AnalysisTask {
  type: AnalysisTaskType;
  content: string;
  context?: Record<string, unknown>;
}

export interface LLMConfig {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  defaultProvider?: ProviderName;
  defaultModel?: string;
}
