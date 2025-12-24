import Handlebars from 'handlebars';
import { PromptTemplate, TokenBudget } from '../types';

// Register custom Handlebars helpers
Handlebars.registerHelper('json', function (context) {
  return JSON.stringify(context, null, 2);
});

Handlebars.registerHelper('truncate', function (text: string, length: number) {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
});

Handlebars.registerHelper('codeBlock', function (code: string, language: string) {
  return new Handlebars.SafeString(`\`\`\`${language}\n${code}\n\`\`\``);
});

Handlebars.registerHelper('ifEquals', function (arg1, arg2, options) {
  return arg1 === arg2 ? options.fn(this) : options.inverse(this);
});

export class TemplateEngine {
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();

  /**
   * Compile and cache a template
   */
  compile(name: string, template: string): HandlebarsTemplateDelegate {
    if (!this.compiledTemplates.has(name)) {
      this.compiledTemplates.set(name, Handlebars.compile(template));
    }
    return this.compiledTemplates.get(name)!;
  }

  /**
   * Render a template with context
   */
  render(template: string, context: Record<string, unknown>): string {
    const compiled = Handlebars.compile(template);
    return compiled(context);
  }

  /**
   * Render a named template with context
   */
  renderNamed(name: string, template: string, context: Record<string, unknown>): string {
    const compiled = this.compile(name, template);
    return compiled(context);
  }

  /**
   * Build a complete prompt from a template
   */
  buildPrompt(
    template: PromptTemplate,
    context: Record<string, unknown>,
  ): { systemPrompt: string; userPrompt: string } {
    return {
      systemPrompt: this.render(template.systemPrompt, context),
      userPrompt: this.render(template.userPromptTemplate, context),
    };
  }

  /**
   * Estimate tokens for a rendered prompt
   */
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate content to fit within token budget
   */
  fitToBudget(
    content: string,
    budget: TokenBudget,
    strategy: 'head' | 'tail' | 'smart' = 'smart',
  ): string {
    const availableTokens =
      budget.maxInputTokens - budget.reserveForTools - budget.reserveForContext;
    const currentTokens = this.estimateTokens(content);

    if (currentTokens <= availableTokens) {
      return content;
    }

    const targetChars = availableTokens * 4; // Reverse the estimation

    switch (strategy) {
      case 'head':
        return content.substring(0, targetChars) + '\n\n[Content truncated...]';

      case 'tail':
        return '[Content truncated...]\n\n' + content.substring(content.length - targetChars);

      case 'smart':
        return this.smartTruncate(content, targetChars);

      default:
        return content.substring(0, targetChars);
    }
  }

  /**
   * Smart truncation that preserves structure
   */
  private smartTruncate(content: string, targetChars: number): string {
    const lines = content.split('\n');

    // Keep imports/requires at the top
    const importLines: string[] = [];
    const bodyLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('import ') ||
        trimmed.startsWith('from ') ||
        trimmed.startsWith('require(') ||
        trimmed.startsWith('const ') && trimmed.includes('require(')
      ) {
        importLines.push(line);
      } else {
        bodyLines.push(line);
      }
    }

    const imports = importLines.join('\n');
    const importChars = imports.length + 50; // Buffer for separator

    if (importChars >= targetChars) {
      // Just return truncated imports
      return imports.substring(0, targetChars) + '\n\n[Content truncated...]';
    }

    const bodyTargetChars = targetChars - importChars;
    const body = bodyLines.join('\n');

    // Take from the beginning of the body
    const truncatedBody = body.substring(0, bodyTargetChars);

    // Try to end at a natural boundary (end of function/class)
    const lastBrace = truncatedBody.lastIndexOf('}');
    const lastSemicolon = truncatedBody.lastIndexOf(';');
    const cutPoint = Math.max(lastBrace, lastSemicolon);

    const finalBody =
      cutPoint > bodyTargetChars * 0.5
        ? truncatedBody.substring(0, cutPoint + 1)
        : truncatedBody;

    return imports + '\n\n' + finalBody + '\n\n[Content truncated...]';
  }
}

export const templateEngine = new TemplateEngine();
