import { z } from 'zod';
import {
  LLMProvider,
  LLMConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  AnalysisTask,
  ProviderName,
} from './types';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { selectModelForTask, getModelConfig } from './models';
import { templateEngine } from './prompts/template-engine';
import { getPromptTemplate, PromptTemplateName } from './prompts/debt-analysis';
import { getBudgetForTask, estimateTokens, fitsWithinBudget } from './budget';

export class LLMClient {
  private providers: Map<ProviderName, LLMProvider> = new Map();
  private defaultProvider: ProviderName;
  private defaultModel: string;

  constructor(config: LLMConfig) {
    // Initialize providers based on available API keys
    if (config.openaiApiKey) {
      this.providers.set('openai', new OpenAIProvider(config.openaiApiKey));
    }

    if (config.anthropicApiKey) {
      this.providers.set('anthropic', new AnthropicProvider(config.anthropicApiKey));
    }

    if (this.providers.size === 0) {
      throw new Error('At least one LLM provider API key is required');
    }

    // Set defaults
    this.defaultProvider = config.defaultProvider || this.getFirstAvailableProvider();
    this.defaultModel = config.defaultModel || this.getDefaultModelForProvider(this.defaultProvider);
  }

  /**
   * Get a specific provider
   */
  getProvider(name: ProviderName): LLMProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider ${name} is not configured`);
    }
    return provider;
  }

  /**
   * Check if a provider is available
   */
  hasProvider(name: ProviderName): boolean {
    return this.providers.has(name);
  }

  /**
   * Run a completion request
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model || this.defaultModel;
    const config = getModelConfig(model);

    if (!config) {
      throw new Error(`Unknown model: ${model}`);
    }

    const provider = this.getProvider(config.provider);
    return provider.complete({ ...request, model });
  }

  /**
   * Run a structured completion request
   */
  async completeStructured<T>(
    request: CompletionRequest,
    schema: z.ZodSchema<T>,
  ): Promise<T> {
    const model = request.model || this.defaultModel;
    const config = getModelConfig(model);

    if (!config) {
      throw new Error(`Unknown model: ${model}`);
    }

    const provider = this.getProvider(config.provider);
    return provider.completeStructured({ ...request, model }, schema);
  }

  /**
   * Stream a completion request
   */
  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const model = request.model || this.defaultModel;
    const config = getModelConfig(model);

    if (!config) {
      throw new Error(`Unknown model: ${model}`);
    }

    const provider = this.getProvider(config.provider);
    yield* provider.stream({ ...request, model });
  }

  /**
   * Run an analysis task with automatic model selection
   */
  async runAnalysisTask<T>(
    task: AnalysisTask,
    schema?: z.ZodSchema<T>,
  ): Promise<T extends undefined ? CompletionResponse : T> {
    const model = selectModelForTask(task.type);
    const budget = getBudgetForTask(task.type);

    // Check if content fits within budget
    const contentTokens = estimateTokens(task.content);
    let content = task.content;

    if (!fitsWithinBudget(contentTokens, budget)) {
      // Truncate content to fit
      content = templateEngine.fitToBudget(task.content, budget, 'smart');
    }

    const request: CompletionRequest = {
      model,
      messages: [{ role: 'user', content }],
      maxTokens: budget.maxOutputTokens,
      temperature: 0.3, // Lower temperature for analysis tasks
      ...task.context,
    };

    if (schema) {
      return this.completeStructured(request, schema) as Promise<
        T extends undefined ? CompletionResponse : T
      >;
    }

    return this.complete(request) as Promise<
      T extends undefined ? CompletionResponse : T
    >;
  }

  /**
   * Run an analysis using a predefined template
   */
  async runWithTemplate<T>(
    templateName: PromptTemplateName,
    context: Record<string, unknown>,
    schema?: z.ZodSchema<T>,
  ): Promise<T extends undefined ? CompletionResponse : T> {
    const template = getPromptTemplate(templateName);
    const { systemPrompt, userPrompt } = templateEngine.buildPrompt(template, context);

    // Check budget if defined
    if (template.tokenBudget) {
      const totalTokens = estimateTokens(systemPrompt + userPrompt);
      if (!fitsWithinBudget(totalTokens, template.tokenBudget)) {
        throw new Error(
          `Prompt exceeds token budget: ${totalTokens} tokens vs ${template.tokenBudget.maxInputTokens} max`,
        );
      }
    }

    const request: CompletionRequest = {
      model: this.defaultModel,
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: template.tokenBudget?.maxOutputTokens || 2000,
      temperature: 0.3,
    };

    const effectiveSchema = schema || template.outputSchema;

    if (effectiveSchema) {
      return this.completeStructured(request, effectiveSchema as z.ZodSchema<T>) as Promise<
        T extends undefined ? CompletionResponse : T
      >;
    }

    return this.complete(request) as Promise<
      T extends undefined ? CompletionResponse : T
    >;
  }

  /**
   * Count tokens in text
   */
  countTokens(text: string, model?: string): number {
    const targetModel = model || this.defaultModel;
    const config = getModelConfig(targetModel);

    if (!config) {
      return estimateTokens(text);
    }

    const provider = this.providers.get(config.provider);
    return provider?.countTokens(text, targetModel) || estimateTokens(text);
  }

  /**
   * Get the default model
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Set the default model
   */
  setDefaultModel(model: string): void {
    const config = getModelConfig(model);
    if (!config) {
      throw new Error(`Unknown model: ${model}`);
    }
    if (!this.providers.has(config.provider)) {
      throw new Error(`Provider ${config.provider} is not configured for model ${model}`);
    }
    this.defaultModel = model;
    this.defaultProvider = config.provider;
  }

  private getFirstAvailableProvider(): ProviderName {
    const [first] = this.providers.keys();
    return first;
  }

  private getDefaultModelForProvider(provider: ProviderName): string {
    switch (provider) {
      case 'openai':
        return 'gpt-4o';
      case 'anthropic':
        return 'claude-3-5-sonnet-latest';
      default:
        return 'gpt-4o';
    }
  }
}

/**
 * Create an LLM client from environment variables
 */
export function createLLMClient(config?: Partial<LLMConfig>): LLMClient {
  return new LLMClient({
    openaiApiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY,
    anthropicApiKey: config?.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
    defaultProvider: config?.defaultProvider,
    defaultModel: config?.defaultModel,
  });
}
