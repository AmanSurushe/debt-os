import Anthropic from '@anthropic-ai/sdk';
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
import { calculateCost } from './models';

export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic' as const;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const messages = this.formatMessages(request);
    const tools = request.tools ? this.formatTools(request.tools) : undefined;

    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens || 4096,
      system: request.systemPrompt,
      messages,
      temperature: request.temperature ?? 0.7,
      tools,
      tool_choice: this.formatToolChoice(request.toolChoice, tools),
    });

    const content = this.extractContent(response.content);
    const toolCalls = this.extractToolCalls(response.content);

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        totalCost: calculateCost(
          request.model,
          response.usage.input_tokens,
          response.usage.output_tokens,
        ),
      },
      finishReason: this.mapStopReason(response.stop_reason),
      model: response.model,
    };
  }

  async completeStructured<T>(
    request: CompletionRequest,
    schema: z.ZodSchema<T>,
  ): Promise<T> {
    const jsonSchema = zodToJsonSchema(schema);

    // Use tool use to get structured output from Anthropic
    const toolDef: Anthropic.Tool = {
      name: 'structured_output',
      description: 'Output the response in the required structured format',
      input_schema: jsonSchema as Anthropic.Tool['input_schema'],
    };

    const messages = this.formatMessages(request);

    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens || 4096,
      system: request.systemPrompt,
      messages,
      temperature: request.temperature ?? 0,
      tools: [toolDef],
      tool_choice: { type: 'tool', name: 'structured_output' },
    });

    // Extract the tool use result
    for (const block of response.content) {
      if (block.type === 'tool_use' && block.name === 'structured_output') {
        return schema.parse(block.input);
      }
    }

    throw new Error('No structured output returned from Anthropic');
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const messages = this.formatMessages(request);
    const tools = request.tools ? this.formatTools(request.tools) : undefined;

    const stream = this.client.messages.stream({
      model: request.model,
      max_tokens: request.maxTokens || 4096,
      system: request.systemPrompt,
      messages,
      temperature: request.temperature ?? 0.7,
      tools,
      tool_choice: this.formatToolChoice(request.toolChoice, tools),
    });

    let currentToolCall: Partial<ToolCall> | undefined;
    let toolInputBuffer = '';

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          currentToolCall = {
            id: event.content_block.id,
            name: event.content_block.name,
          };
          toolInputBuffer = '';
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { content: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          toolInputBuffer += event.delta.partial_json;
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolCall) {
          try {
            currentToolCall.arguments = JSON.parse(toolInputBuffer);
          } catch {
            currentToolCall.arguments = {};
          }
          yield { toolCall: currentToolCall };
          currentToolCall = undefined;
        }
      } else if (event.type === 'message_stop') {
        yield { finishReason: 'stop' };
      }
    }
  }

  countTokens(text: string, _model?: string): number {
    // Rough estimation: ~4 characters per token for code
    // Anthropic has a token counting API but it's async
    return Math.ceil(text.length / 4);
  }

  private formatMessages(
    request: CompletionRequest,
  ): Anthropic.MessageParam[] {
    const messages: Anthropic.MessageParam[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        // System messages are handled separately in Anthropic
        continue;
      }
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    return messages;
  }

  private formatTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: zodToJsonSchema(tool.parameters) as Anthropic.Tool['input_schema'],
    }));
  }

  private formatToolChoice(
    choice?: CompletionRequest['toolChoice'],
    tools?: Anthropic.Tool[],
  ): Anthropic.ToolChoice | undefined {
    if (!choice || !tools || tools.length === 0) return undefined;

    if (choice === 'auto') return { type: 'auto' };
    if (choice === 'required') return { type: 'any' };
    if (choice === 'none') return undefined;
    if (typeof choice === 'object') {
      return { type: 'tool', name: choice.name };
    }
    return undefined;
  }

  private extractContent(content: Anthropic.ContentBlock[]): string {
    const textBlocks = content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    return textBlocks.map((block) => block.text).join('');
  }

  private extractToolCalls(content: Anthropic.ContentBlock[]): ToolCall[] {
    const toolUseBlocks = content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    return toolUseBlocks.map((block) => ({
      id: block.id,
      name: block.name,
      arguments: block.input as Record<string, unknown>,
    }));
  }

  private mapStopReason(
    reason: Anthropic.Message['stop_reason'],
  ): CompletionResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'tool_use':
        return 'tool_calls';
      case 'max_tokens':
        return 'length';
      default:
        return 'stop';
    }
  }
}
