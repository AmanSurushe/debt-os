import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LLMClient,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  AnalysisTask,
  DebtFindingSchema,
  DebtFinding,
  getPromptTemplate,
  PromptTemplateName,
  templateEngine,
  estimateTokens,
} from '@debt-os/llm';
import { z } from 'zod';

@Injectable()
export class LLMService implements OnModuleInit {
  private readonly logger = new Logger(LLMService.name);
  private client: LLMClient | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (openaiKey || anthropicKey) {
      this.client = new LLMClient({
        openaiApiKey: openaiKey,
        anthropicApiKey: anthropicKey,
      });
      this.logger.log(
        `LLM Client initialized with providers: ${[
          openaiKey ? 'OpenAI' : null,
          anthropicKey ? 'Anthropic' : null,
        ]
          .filter(Boolean)
          .join(', ')}`,
      );
    } else {
      this.logger.warn('No LLM API keys configured - LLM features will be unavailable');
    }
  }

  /**
   * Check if LLM service is configured and available
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Run a completion request
   */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    this.ensureConfigured();
    return this.client!.complete(request);
  }

  /**
   * Run a structured completion request
   */
  async completeStructured<T>(
    request: CompletionRequest,
    schema: z.ZodSchema<T>,
  ): Promise<T> {
    this.ensureConfigured();
    return this.client!.completeStructured(request, schema);
  }

  /**
   * Stream a completion request
   */
  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    this.ensureConfigured();
    yield* this.client!.stream(request);
  }

  /**
   * Analyze a file for technical debt
   */
  async analyzeFileForDebt(
    filePath: string,
    content: string,
    language: string,
    relatedContext?: string,
  ): Promise<DebtFinding> {
    this.ensureConfigured();

    const template = getPromptTemplate('file-analysis');
    const { systemPrompt, userPrompt } = templateEngine.buildPrompt(template, {
      filePath,
      content,
      language,
      relatedContext,
    });

    this.logger.debug(`Analyzing file ${filePath} (${estimateTokens(content)} tokens)`);

    const result = await this.client!.completeStructured(
      {
        model: 'gpt-4o',
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 2000,
        temperature: 0.3,
      },
      DebtFindingSchema,
    );

    this.logger.debug(
      `Found ${result.findings.length} issues in ${filePath} (health: ${result.fileHealthScore})`,
    );

    return result;
  }

  /**
   * Run architecture analysis
   */
  async analyzeArchitecture(
    repositoryName: string,
    primaryLanguage: string,
    fileTree: string,
    dependencies: Array<{ from: string; to: string }>,
    sampleFiles?: Array<{ path: string; language: string; content: string }>,
  ): Promise<CompletionResponse> {
    this.ensureConfigured();

    const template = getPromptTemplate('architecture-analysis');
    const { systemPrompt, userPrompt } = templateEngine.buildPrompt(template, {
      repositoryName,
      primaryLanguage,
      fileTree,
      dependencies,
      sampleFiles,
    });

    return this.client!.complete({
      model: 'claude-3-5-sonnet-latest',
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 4000,
      temperature: 0.3,
    });
  }

  /**
   * Create a remediation plan for debt items
   */
  async createRemediationPlan(
    debtItems: Array<{
      title: string;
      debtType: string;
      severity: string;
      filePath: string;
      startLine: number | null;
      endLine: number | null;
      description: string;
    }>,
    context: {
      languages: string[];
      teamSize?: number;
      sprintLength?: string;
    },
  ): Promise<CompletionResponse> {
    this.ensureConfigured();

    const template = getPromptTemplate('remediation-planning');
    const { systemPrompt, userPrompt } = templateEngine.buildPrompt(template, {
      debtItems,
      languages: context.languages.join(', '),
      teamSize: context.teamSize || 'Unknown',
      sprintLength: context.sprintLength || '2 weeks',
    });

    return this.client!.complete({
      model: 'claude-opus-4-20250514',
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 4000,
      temperature: 0.3,
    });
  }

  /**
   * Run analysis with a specific template
   */
  async runWithTemplate<T>(
    templateName: PromptTemplateName,
    context: Record<string, unknown>,
    schema?: z.ZodSchema<T>,
  ): Promise<T extends undefined ? CompletionResponse : T> {
    this.ensureConfigured();
    return this.client!.runWithTemplate(templateName, context, schema);
  }

  /**
   * Count tokens in text
   */
  countTokens(text: string, model?: string): number {
    if (this.client) {
      return this.client.countTokens(text, model);
    }
    return estimateTokens(text);
  }

  /**
   * Get the default model
   */
  getDefaultModel(): string | null {
    return this.client?.getDefaultModel() || null;
  }

  /**
   * Set the default model
   */
  setDefaultModel(model: string): void {
    this.ensureConfigured();
    this.client!.setDefaultModel(model);
  }

  private ensureConfigured(): void {
    if (!this.client) {
      throw new Error('LLM service is not configured - missing API keys');
    }
  }
}
