import { StateGraph, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
import { DebtFinding, FileInfo, AgentError, RepoContext } from '../../types';
import { AgentConfig } from '../types';
import { ToolContext, createFileTools, createAnalysisTools } from '../../tools';

// Architect state
const ArchitectStateAnnotation = Annotation.Root({
  repoContext: Annotation<RepoContext>,
  files: Annotation<FileInfo[]>,
  dependencyMap: Annotation<Map<string, string[]>>,
  findings: Annotation<DebtFinding[]>,
  errors: Annotation<AgentError[]>,
  phase: Annotation<'mapping' | 'analyzing' | 'complete'>,
});

type ArchitectState = typeof ArchitectStateAnnotation.State;

export interface ArchitectAgentConfig {
  agentConfig: AgentConfig;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  toolContext: ToolContext;
}

export function createArchitectAgent(config: ArchitectAgentConfig) {
  const { agentConfig, toolContext } = config;

  const llm = agentConfig.model.startsWith('gpt')
    ? new ChatOpenAI({
        modelName: agentConfig.model,
        temperature: agentConfig.temperature,
        maxTokens: agentConfig.maxTokens,
        openAIApiKey: config.openaiApiKey,
      })
    : new ChatAnthropic({
        modelName: agentConfig.model,
        temperature: agentConfig.temperature,
        maxTokens: agentConfig.maxTokens,
        anthropicApiKey: config.anthropicApiKey,
      });

  const tools = [...createFileTools(toolContext), ...createAnalysisTools()];
  const llmWithTools = llm.bindTools(tools);

  // Node: Map dependencies
  async function mapDependencies(state: ArchitectState): Promise<Partial<ArchitectState>> {
    const { files } = state;
    const dependencyMap = new Map<string, string[]>();

    // Analyze imports/requires in each file
    for (const file of files) {
      const imports = extractImports(file.content, file.language || 'typescript');
      dependencyMap.set(file.path, imports);
    }

    return {
      dependencyMap,
      phase: 'analyzing',
    };
  }

  // Node: Analyze architecture
  async function analyzeArchitecture(state: ArchitectState): Promise<Partial<ArchitectState>> {
    const { repoContext, files, dependencyMap, findings, errors } = state;

    // Build architectural analysis context
    const structureSummary = buildStructureSummary(repoContext, dependencyMap);
    const circularDeps = findCircularDependencies(dependencyMap);
    const layerViolations = detectLayerViolations(dependencyMap, files);

    const newFindings: DebtFinding[] = [];

    // Report circular dependencies
    for (const cycle of circularDeps) {
      newFindings.push({
        id: uuidv4(),
        debtType: 'circular_dependency',
        severity: 'high',
        confidence: 0.95,
        title: `Circular dependency detected`,
        description: `Circular dependency between modules: ${cycle.join(' → ')} → ${cycle[0]}`,
        filePath: cycle[0],
        evidence: cycle.map((f) => `Import chain includes: ${f}`),
        suggestedFix: 'Break the cycle by extracting shared code into a separate module or using dependency injection.',
      });
    }

    // Report layer violations
    for (const violation of layerViolations) {
      newFindings.push({
        id: uuidv4(),
        debtType: 'layer_violation',
        severity: 'medium',
        confidence: 0.8,
        title: `Layer violation: ${violation.from} imports ${violation.to}`,
        description: violation.reason,
        filePath: violation.from,
        evidence: [`${violation.from} should not import from ${violation.to}`],
        suggestedFix: 'Refactor to respect layer boundaries. Use dependency inversion if needed.',
      });
    }

    // Use LLM for deeper architectural analysis
    try {
      const llmFindings = await performLLMArchitectureAnalysis(
        llmWithTools,
        agentConfig.systemPrompt,
        structureSummary,
        files.filter((f) => isSignificantFile(f)),
      );
      newFindings.push(...llmFindings);
    } catch (error) {
      errors.push({
        agent: 'architect',
        message: `LLM analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        recoverable: true,
      });
    }

    return {
      findings: [...findings, ...newFindings],
      errors,
      phase: 'complete',
    };
  }

  // Build graph
  const graph = new StateGraph(ArchitectStateAnnotation)
    .addNode('mapDependencies', mapDependencies)
    .addNode('analyzeArchitecture', analyzeArchitecture)
    .addEdge('__start__', 'mapDependencies')
    .addEdge('mapDependencies', 'analyzeArchitecture')
    .addEdge('analyzeArchitecture', '__end__');

  return graph.compile();
}

// Helper functions

function extractImports(content: string, language: string): string[] {
  const imports: string[] = [];

  if (['typescript', 'javascript'].includes(language)) {
    // ES6 imports
    const esImportRegex = /import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = esImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // CommonJS requires
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  } else if (language === 'python') {
    const importRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1] || match[2]);
    }
  }

  // Filter out external packages (node_modules, etc.)
  return imports.filter((imp) => imp.startsWith('.') || imp.startsWith('/'));
}

function findCircularDependencies(dependencyMap: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(file: string, path: string[]): void {
    if (stack.has(file)) {
      // Found a cycle
      const cycleStart = path.indexOf(file);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
      }
      return;
    }

    if (visited.has(file)) return;

    visited.add(file);
    stack.add(file);

    const deps = dependencyMap.get(file) || [];
    for (const dep of deps) {
      // Resolve relative path
      const resolvedDep = resolvePath(file, dep);
      if (dependencyMap.has(resolvedDep)) {
        dfs(resolvedDep, [...path, file]);
      }
    }

    stack.delete(file);
  }

  for (const file of dependencyMap.keys()) {
    dfs(file, []);
  }

  return cycles;
}

function resolvePath(from: string, to: string): string {
  if (to.startsWith('/')) return to;

  const fromParts = from.split('/').slice(0, -1);
  const toParts = to.split('/');

  for (const part of toParts) {
    if (part === '..') {
      fromParts.pop();
    } else if (part !== '.') {
      fromParts.push(part);
    }
  }

  // Add common extensions if not present
  let result = fromParts.join('/');
  if (!result.includes('.')) {
    result += '.ts'; // Default to TypeScript
  }

  return result;
}

interface LayerViolation {
  from: string;
  to: string;
  reason: string;
}

function detectLayerViolations(
  dependencyMap: Map<string, string[]>,
  files: FileInfo[],
): LayerViolation[] {
  const violations: LayerViolation[] = [];

  // Define common layer patterns
  const layers = [
    { pattern: /\/controllers?\//i, level: 1, name: 'controller' },
    { pattern: /\/services?\//i, level: 2, name: 'service' },
    { pattern: /\/repositories?|\/data\//i, level: 3, name: 'repository' },
    { pattern: /\/entities?|\/models?\//i, level: 4, name: 'entity' },
  ];

  function getLayer(path: string): { level: number; name: string } | null {
    for (const layer of layers) {
      if (layer.pattern.test(path)) {
        return { level: layer.level, name: layer.name };
      }
    }
    return null;
  }

  for (const [file, deps] of dependencyMap) {
    const fileLayer = getLayer(file);
    if (!fileLayer) continue;

    for (const dep of deps) {
      const resolvedDep = resolvePath(file, dep);
      const depLayer = getLayer(resolvedDep);

      if (depLayer && depLayer.level < fileLayer.level) {
        violations.push({
          from: file,
          to: resolvedDep,
          reason: `${fileLayer.name} layer should not import from ${depLayer.name} layer (violates dependency rule)`,
        });
      }
    }
  }

  return violations;
}

function buildStructureSummary(
  repoContext: RepoContext,
  dependencyMap: Map<string, string[]>,
): string {
  const lines: string[] = [
    `Repository: ${repoContext.fullName}`,
    `Languages: ${repoContext.languages.join(', ')}`,
    `Total files: ${repoContext.fileCount}`,
    '',
    'Directory Structure:',
  ];

  for (const [dir, files] of Object.entries(repoContext.structure).slice(0, 20)) {
    lines.push(`  ${dir}/: ${files.length} files`);
  }

  lines.push('');
  lines.push(`Dependency connections: ${dependencyMap.size} files with imports`);

  return lines.join('\n');
}

function isSignificantFile(file: FileInfo): boolean {
  // Focus on larger files and entry points
  return (
    file.lineCount > 50 ||
    file.path.includes('index') ||
    file.path.includes('main') ||
    file.path.includes('app')
  );
}

async function performLLMArchitectureAnalysis(
  llm: ReturnType<typeof ChatOpenAI.prototype.bindTools>,
  systemPrompt: string,
  structureSummary: string,
  significantFiles: FileInfo[],
): Promise<DebtFinding[]> {
  const findings: DebtFinding[] = [];

  // Analyze key files for god classes and feature envy
  for (const file of significantFiles.slice(0, 10)) {
    const userPrompt = `Analyze this file for architectural issues:

${structureSummary}

File: ${file.path} (${file.lineCount} lines)

\`\`\`${file.language || ''}
${file.content.slice(0, 6000)}
\`\`\`

Look for:
1. God class (too many responsibilities)
2. Feature envy (methods that use other classes more than their own)
3. Inappropriate intimacy (classes too tightly coupled)
4. Data classes with no behavior
5. Primitive obsession

Use report_debt tool for each issue found.`;

    try {
      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);

      if (response.tool_calls && response.tool_calls.length > 0) {
        for (const toolCall of response.tool_calls) {
          if (toolCall.name === 'report_debt') {
            const args = toolCall.args as Record<string, unknown>;
            findings.push({
              id: uuidv4(),
              debtType: args.debtType as string,
              severity: args.severity as DebtFinding['severity'],
              confidence: args.confidence as number,
              title: args.title as string,
              description: args.description as string,
              filePath: file.path,
              startLine: args.startLine as number | undefined,
              endLine: args.endLine as number | undefined,
              evidence: args.evidence as string[],
              suggestedFix: args.suggestedFix as string | undefined,
            });
          }
        }
      }
    } catch {
      // Skip file on error
    }
  }

  return findings;
}

export async function runArchitectAgent(
  config: ArchitectAgentConfig,
  repoContext: RepoContext,
  files: FileInfo[],
): Promise<{
  findings: DebtFinding[];
  errors: AgentError[];
}> {
  const graph = createArchitectAgent(config);

  const initialState: ArchitectState = {
    repoContext,
    files,
    dependencyMap: new Map(),
    findings: [],
    errors: [],
    phase: 'mapping',
  };

  const result = await graph.invoke(initialState);

  return {
    findings: result.findings,
    errors: result.errors,
  };
}
