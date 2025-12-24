import { z } from 'zod';
import { PromptTemplate } from '../types';

// Schema for debt findings
export const DebtFindingSchema = z.object({
  findings: z.array(
    z.object({
      debtType: z.enum([
        'code_smell',
        'complexity',
        'duplication',
        'dead_code',
        'circular_dependency',
        'layer_violation',
        'god_class',
        'feature_envy',
        'hardcoded_config',
        'security_issue',
        'missing_tests',
        'missing_docs',
        'outdated_dependency',
        'vulnerable_dependency',
      ]),
      severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
      title: z.string().max(100),
      description: z.string().max(500),
      startLine: z.number().nullable(),
      endLine: z.number().nullable(),
      evidence: z.array(z.string()),
      suggestedFix: z.string().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  overallAssessment: z.string().max(300),
  fileHealthScore: z.number().min(0).max(100),
});

export type DebtFinding = z.infer<typeof DebtFindingSchema>;

// File Analysis Template
export const FILE_ANALYSIS_TEMPLATE: PromptTemplate = {
  name: 'file-analysis',
  systemPrompt: `You are a senior software engineer analyzing code for technical debt.

Your task is to identify technical debt in the provided code file. Consider:
- Code smells (long methods, deep nesting, magic numbers, poor naming)
- Design issues (god classes, feature envy, inappropriate intimacy)
- Maintainability concerns (missing abstractions, complex conditionals)
- Potential bugs or security issues
- Missing or inadequate error handling
- Performance anti-patterns

Be precise and actionable. Only flag genuine issues, not stylistic preferences.
Focus on issues that would make the code harder to maintain or extend.

IMPORTANT:
- Be specific about line numbers where issues occur
- Provide clear, actionable suggestions for fixes
- Rate your confidence in each finding (0.0-1.0)
- Consider the context and language conventions`,

  userPromptTemplate: `Analyze this {{language}} file for technical debt:

File: {{filePath}}
\`\`\`{{language}}
{{content}}
\`\`\`

{{#if relatedContext}}
Related context:
{{relatedContext}}
{{/if}}

{{#if previousFindings}}
Previous findings in this file (for reference):
{{#each previousFindings}}
- {{this.title}} ({{this.severity}})
{{/each}}
{{/if}}

Identify any technical debt. For each item found, provide:
1. Type of debt (from the predefined categories)
2. Severity (critical/high/medium/low/info)
3. Location (line numbers if applicable)
4. Clear description of the issue
5. Why it's problematic
6. Suggested fix

Also provide an overall assessment and health score (0-100) for the file.`,

  outputSchema: DebtFindingSchema,
  tokenBudget: {
    maxInputTokens: 8000,
    maxOutputTokens: 2000,
    reserveForTools: 500,
    reserveForContext: 1500,
  },
};

// Architecture Analysis Template
export const ARCHITECTURE_ANALYSIS_TEMPLATE: PromptTemplate = {
  name: 'architecture-analysis',
  systemPrompt: `You are a senior software architect analyzing codebase structure for architectural issues.

Your task is to identify architectural technical debt, including:
- Circular dependencies between modules
- Layer violations (e.g., UI accessing database directly)
- God modules/classes that do too much
- Missing abstraction layers
- Tight coupling between unrelated components
- Violation of SOLID principles at the module level
- Inconsistent patterns across the codebase

Focus on systemic issues that affect the overall health of the codebase.
Consider maintainability, testability, and scalability implications.`,

  userPromptTemplate: `Analyze the following codebase structure for architectural issues:

Repository: {{repositoryName}}
Primary Language: {{primaryLanguage}}

File Structure:
{{fileTree}}

Module Dependencies:
{{#each dependencies}}
{{this.from}} -> {{this.to}}
{{/each}}

{{#if sampleFiles}}
Sample files for context:
{{#each sampleFiles}}
--- {{this.path}} ---
\`\`\`{{this.language}}
{{this.content}}
\`\`\`
{{/each}}
{{/if}}

Identify architectural issues and provide:
1. Issue type and severity
2. Affected modules/files
3. Impact on maintainability
4. Recommended remediation approach`,

  tokenBudget: {
    maxInputTokens: 32000,
    maxOutputTokens: 4000,
    reserveForTools: 1000,
    reserveForContext: 4000,
  },
};

// Remediation Planning Template
export const REMEDIATION_TEMPLATE: PromptTemplate = {
  name: 'remediation-planning',
  systemPrompt: `You are a technical lead planning remediation of technical debt.

Your task is to create actionable remediation plans that consider:
- Business impact and risk
- Effort estimation
- Dependencies between fixes
- Quick wins vs strategic improvements
- Team capacity and skill requirements

Prioritize based on:
1. Security vulnerabilities (highest priority)
2. Bugs and correctness issues
3. Performance problems
4. Maintainability improvements
5. Code quality enhancements`,

  userPromptTemplate: `Create a remediation plan for the following technical debt items:

{{#each debtItems}}
## {{this.title}}
- Type: {{this.debtType}}
- Severity: {{this.severity}}
- Location: {{this.filePath}}:{{this.startLine}}-{{this.endLine}}
- Description: {{this.description}}

{{/each}}

Repository Context:
- Languages: {{languages}}
- Team Size: {{teamSize}}
- Sprint Length: {{sprintLength}}

Create a prioritized remediation plan with:
1. Grouped tasks (related items that should be fixed together)
2. Priority order
3. Effort estimates (trivial/small/medium/large/xlarge)
4. Dependencies between tasks
5. Quick wins to tackle first
6. Risks and considerations`,
};

// Code Review Template
export const CODE_REVIEW_TEMPLATE: PromptTemplate = {
  name: 'code-review',
  systemPrompt: `You are a senior developer performing a code review focused on quality and maintainability.

Review the code changes for:
- Correctness and potential bugs
- Security vulnerabilities
- Performance issues
- Code style and readability
- Test coverage adequacy
- Documentation completeness

Be constructive and specific. Distinguish between must-fix issues and suggestions.`,

  userPromptTemplate: `Review the following code changes:

{{#each files}}
### {{this.path}}
\`\`\`diff
{{this.diff}}
\`\`\`
{{/each}}

Context:
- PR Title: {{prTitle}}
- Description: {{prDescription}}

Provide:
1. Critical issues that must be addressed
2. Suggestions for improvement
3. Questions for the author
4. Overall assessment`,
};

// Summarization Template
export const SUMMARIZATION_TEMPLATE: PromptTemplate = {
  name: 'summarization',
  systemPrompt: `You are a technical writer creating concise summaries of code and findings.

Create clear, accurate summaries that:
- Highlight the most important information
- Use appropriate technical terminology
- Are accessible to the target audience
- Include actionable insights`,

  userPromptTemplate: `Summarize the following {{contentType}}:

{{content}}

Target audience: {{audience}}
Maximum length: {{maxLength}} words

Provide a clear, structured summary.`,
};

// Export all templates
export const PROMPT_TEMPLATES = {
  'file-analysis': FILE_ANALYSIS_TEMPLATE,
  'architecture-analysis': ARCHITECTURE_ANALYSIS_TEMPLATE,
  'remediation-planning': REMEDIATION_TEMPLATE,
  'code-review': CODE_REVIEW_TEMPLATE,
  'summarization': SUMMARIZATION_TEMPLATE,
};

export type PromptTemplateName = keyof typeof PROMPT_TEMPLATES;

export function getPromptTemplate(name: PromptTemplateName): PromptTemplate {
  return PROMPT_TEMPLATES[name];
}
