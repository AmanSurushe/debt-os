import OpenAI from 'openai';
import { z } from 'zod';
import { zodToJsonSchema } from './utils/zod-to-json';
import {
  LLMProvider,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  ToolDefinition,
  ToolCall,
} from './types';
import { calculateCost, getModelConfig } from './models';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai' as const;
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const messages = this.formatMessages(request);
    const tools = request.tools ? this.formatTools(request.tools) : undefined;

    const response = await this.client.chat.completions.create({
      model: request.model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      tools,
      tool_choice: this.formatToolChoice(request.toolChoice),
      response_format: request.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    });

    const choice = response.choices[0];
    const toolCalls = this.parseToolCalls(choice.message.tool_calls);

    return {
      content: choice.message.content || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        totalCost: calculateCost(request.model, response.usage?.prompt_tokens || 0, response.usage?.completion_tokens || 0),
      },
      finishReason: this.mapFinishReason(choice.finish_reason),
      model: response.model,
    };
  }

  async completeStructured<T>(request: CompletionRequest, schema: z.ZodSchema<T>): Promise<T> {
    const jsonSchema = zodToJsonSchema(schema);
    const config = getModelConfig(request.model);

    if (config?.supportsStructuredOutput) {
      const response = await this.client.chat.completions.create({
        model: request.model,
        messages: this.formatMessages(request),
        temperature: request.temperature ?? 0,
        max_tokens: request.maxTokens,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'response', strict: true, schema: jsonSchema },
        } as OpenAI.ChatCompletionCreateParams['response_format'],
      });
      const content = response.choices[0].message.content || '{}';
      return schema.parse(JSON.parse(content));
    }

    const modifiedRequest: CompletionRequest = {
      ...request,
      systemPrompt: `${request.systemPrompt || ''}\n\nRespond with valid JSON matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`,
      responseFormat: 'json',
    };
    const response = await this.complete(modifiedRequest);
    return schema.parse(JSON.parse(response.content));
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const messages = this.formatMessages(request);
    const tools = request.tools ? this.formatTools(request.tools) : undefined;

    const stream = await this.client.chat.completions.create({
      model: request.model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      tools,
      tool_choice: this.formatToolChoice(request.toolChoice),
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) yield { content: delta.content };
      if (chunk.choices[0]?.finish_reason) {
        yield { finishReason: this.mapFinishReason(chunk.choices[0].finish_reason) };
      }
    }
  }

  countTokens(text: string, _model?: string): number {
    return Math.ceil(text.length / 4);
  }

  private formatMessages(request: CompletionRequest): OpenAI.ChatCompletionMessageParam[] {
    const messages: OpenAI.ChatCompletionMessageParam[] = [];
    if (request.systemPrompt) messages.push({ role: 'system', content: request.systemPrompt });
    for (const msg of request.messages) {
      messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }
    return messages;
  }

  private formatTools(tools: ToolDefinition[]): OpenAI.ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters) as Record<string, unknown>,
      },
    }));
  }

  private formatToolChoice(choice?: CompletionRequest['toolChoice']): OpenAI.ChatCompletionToolChoiceOption | undefined {
    if (!choice) return undefined;
    if (choice === 'auto') return 'auto';
    if (choice === 'required') return 'required';
    if (choice === 'none') return 'none';
    if (typeof choice === 'object') return { type: 'function', function: { name: choice.name } };
    return undefined;
  }

  private parseToolCalls(toolCalls?: OpenAI.ChatCompletionMessageToolCall[]): ToolCall[] {
    if (!toolCalls) return [];
    return toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));
  }

  private mapFinishReason(reason: string | null): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'stop': return 'stop';
      case 'tool_calls': return 'tool_calls';
      case 'length': return 'length';
      case 'content_filter': return 'content_filter';
      default: return 'stop';
    }
  }
}
