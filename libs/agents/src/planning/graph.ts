import { StateGraph, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { v4 as uuidv4 } from 'uuid';
import {
  PlanningState,
  DebtFinding,
  RemediationTask,
  RemediationPlan,
  AgentError,
} from '../types';
import { ToolContext, createFileTools } from '../tools';

// State annotation for LangGraph
const PlanningStateAnnotation = Annotation.Root({
  repositoryId: Annotation<string>,
  scanId: Annotation<string>,
  debtItems: Annotation<DebtFinding[]>,
  dependencies: Annotation<Array<{ from: string; to: string }>>,
  tasks: Annotation<RemediationTask[]>,
  remediationPlan: Annotation<RemediationPlan | null>,
  errors: Annotation<AgentError[]>,
  shouldContinue: Annotation<boolean>,
});

type PlanningGraphState = typeof PlanningStateAnnotation.State;

export interface PlanningConfig {
  model: 'gpt-4o' | 'claude-3-5-sonnet-latest';
  openaiApiKey?: string;
  anthropicApiKey?: string;
  toolContext: ToolContext;
}

const PLANNING_SYSTEM_PROMPT = `You are a senior technical lead creating a remediation plan for technical debt.

Your task is to analyze debt findings and create actionable tasks to address them.

Consider:
1. **Grouping**: Related findings should be addressed together
2. **Priority**: Critical security issues first, then high-impact items
3. **Dependencies**: Some fixes depend on others (e.g., refactor before adding tests)
4. **Effort**: Estimate effort realistically (trivial/small/medium/large/xlarge)
5. **Risk**: Consider what could go wrong during remediation
6. **Quick wins**: Identify easy fixes that provide immediate value

For each task, provide:
- Clear title and description
- Related debt item IDs
- Effort estimate
- Priority (1-10, where 1 is highest)
- Dependencies on other tasks
- Concrete approach to implementation
- Potential risks
- Acceptance criteria

Output tasks in JSON format following the RemediationTask schema.`;

const TASK_GROUPING_PROMPT = `Analyze these technical debt findings and group them into remediation tasks.

Group findings by:
1. Same file or module - fixes can be done together
2. Same type of issue - similar fixes across files
3. Logical dependencies - one must be fixed before another

For each group, create a task. Return a JSON array of tasks.`;

export function createPlanningGraph(config: PlanningConfig) {
  // Initialize LLM
  const llm = config.model.startsWith('gpt')
    ? new ChatOpenAI({
        modelName: config.model,
        temperature: 0.3,
        openAIApiKey: config.openaiApiKey,
      })
    : new ChatAnthropic({
        modelName: config.model,
        temperature: 0.3,
        anthropicApiKey: config.anthropicApiKey,
      });

  // Create tools for context
  const tools = createFileTools(config.toolContext);
  const llmWithTools = llm.bindTools(tools);

  // Node: Analyze dependencies between findings
  async function analyzeDependencies(state: PlanningGraphState): Promise<Partial<PlanningGraphState>> {
    const { debtItems } = state;

    if (debtItems.length === 0) {
      return {
        dependencies: [],
      };
    }

    try {
      // Group findings by file
      const fileGroups = new Map<string, DebtFinding[]>();
      for (const item of debtItems) {
        const existing = fileGroups.get(item.filePath) || [];
        existing.push(item);
        fileGroups.set(item.filePath, existing);
      }

      // Identify dependencies based on finding types
      const dependencies: Array<{ from: string; to: string }> = [];

      for (const item of debtItems) {
        // God class should be refactored before adding tests
        if (item.debtType === 'missing_tests') {
          const godClassInSameFile = debtItems.find(
            (d) => d.filePath === item.filePath && d.debtType === 'god_class',
          );
          if (godClassInSameFile) {
            dependencies.push({ from: godClassInSameFile.id, to: item.id });
          }
        }

        // Complexity should be reduced before adding tests
        if (item.debtType === 'missing_tests') {
          const complexityIssue = debtItems.find(
            (d) => d.filePath === item.filePath && d.debtType === 'complexity',
          );
          if (complexityIssue) {
            dependencies.push({ from: complexityIssue.id, to: item.id });
          }
        }

        // Security issues should be fixed before anything else
        if (item.debtType !== 'security_issue') {
          const securityInSameFile = debtItems.find(
            (d) => d.filePath === item.filePath && d.debtType === 'security_issue',
          );
          if (securityInSameFile) {
            dependencies.push({ from: securityInSameFile.id, to: item.id });
          }
        }
      }

      return {
        dependencies,
      };
    } catch (error) {
      return {
        dependencies: [],
        errors: [
          ...state.errors,
          {
            agent: 'planning' as const,
            message: `Error analyzing dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
      };
    }
  }

  // Node: Create remediation tasks
  async function createTasks(state: PlanningGraphState): Promise<Partial<PlanningGraphState>> {
    const { debtItems, dependencies, scanId } = state;

    if (debtItems.length === 0) {
      return {
        tasks: [],
      };
    }

    try {
      // Format debt items for the LLM
      const debtSummary = debtItems
        .map(
          (d) =>
            `- [${d.id}] ${d.severity.toUpperCase()} ${d.debtType}: ${d.title} (${d.filePath}:${d.startLine || '?'})`,
        )
        .join('\n');

      const depSummary =
        dependencies.length > 0
          ? dependencies.map((d) => `- ${d.from} must be fixed before ${d.to}`).join('\n')
          : 'No dependencies identified';

      const userPrompt = `${TASK_GROUPING_PROMPT}

Debt Findings:
${debtSummary}

Identified Dependencies:
${depSummary}

Create remediation tasks. For each task, include:
{
  "title": "string",
  "description": "string",
  "relatedDebtIds": ["id1", "id2"],
  "estimatedEffort": "trivial|small|medium|large|xlarge",
  "priority": 1-10,
  "dependencies": ["taskId"],
  "suggestedApproach": "string",
  "risks": ["risk1"],
  "acceptanceCriteria": ["criterion1"]
}

Return ONLY a JSON array of tasks.`;

      const response = await llm.invoke([
        new SystemMessage(PLANNING_SYSTEM_PROMPT),
        new HumanMessage(userPrompt),
      ]);

      // Parse tasks from response
      const content = response.content as string;
      let tasks: RemediationTask[] = [];

      try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          tasks = parsed.map((t: Record<string, unknown>) => ({
            id: uuidv4(),
            title: t.title as string,
            description: t.description as string,
            relatedDebtIds: t.relatedDebtIds as string[],
            estimatedEffort: t.estimatedEffort as RemediationTask['estimatedEffort'],
            priority: t.priority as number,
            dependencies: t.dependencies as string[],
            suggestedApproach: t.suggestedApproach as string,
            risks: t.risks as string[],
            acceptanceCriteria: t.acceptanceCriteria as string[],
          }));
        }
      } catch {
        // If parsing fails, create basic tasks from debt items
        tasks = createBasicTasks(debtItems);
      }

      return {
        tasks,
      };
    } catch (error) {
      // Fallback to basic task creation
      return {
        tasks: createBasicTasks(debtItems),
        errors: [
          ...state.errors,
          {
            agent: 'planning' as const,
            message: `Error creating tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: new Date(),
            recoverable: true,
          },
        ],
      };
    }
  }

  // Node: Prioritize and organize tasks into a plan
  async function createPlan(state: PlanningGraphState): Promise<Partial<PlanningGraphState>> {
    const { scanId, debtItems, tasks } = state;

    if (tasks.length === 0) {
      return {
        remediationPlan: {
          id: uuidv4(),
          scanId,
          summary: 'No technical debt found requiring remediation.',
          totalDebtItems: 0,
          prioritizedTasks: [],
          quickWins: [],
          strategicWork: [],
          deferrable: [],
        },
      };
    }

    // Sort tasks by priority
    const sortedTasks = [...tasks].sort((a, b) => a.priority - b.priority);

    // Categorize tasks
    const quickWins = sortedTasks.filter(
      (t) =>
        (t.estimatedEffort === 'trivial' || t.estimatedEffort === 'small') &&
        t.dependencies.length === 0,
    );

    const strategicWork = sortedTasks.filter(
      (t) =>
        t.estimatedEffort === 'medium' ||
        t.estimatedEffort === 'large' ||
        t.priority <= 3,
    );

    const deferrable = sortedTasks.filter(
      (t) =>
        t.priority > 7 ||
        (t.estimatedEffort === 'xlarge' && t.priority > 5),
    );

    // Generate summary
    const criticalCount = debtItems.filter((d) => d.severity === 'critical').length;
    const highCount = debtItems.filter((d) => d.severity === 'high').length;

    let summary = `Found ${debtItems.length} technical debt items across ${new Set(debtItems.map((d) => d.filePath)).size} files. `;
    if (criticalCount > 0) {
      summary += `${criticalCount} critical issues require immediate attention. `;
    }
    if (highCount > 0) {
      summary += `${highCount} high-priority items should be addressed soon. `;
    }
    summary += `Organized into ${tasks.length} remediation tasks with ${quickWins.length} quick wins available.`;

    const plan: RemediationPlan = {
      id: uuidv4(),
      scanId,
      summary,
      totalDebtItems: debtItems.length,
      prioritizedTasks: sortedTasks,
      quickWins,
      strategicWork,
      deferrable,
    };

    return {
      remediationPlan: plan,
    };
  }

  // Build the graph
  const graph = new StateGraph(PlanningStateAnnotation)
    .addNode('analyzeDependencies', analyzeDependencies)
    .addNode('createTasks', createTasks)
    .addNode('createPlan', createPlan)
    .addEdge('__start__', 'analyzeDependencies')
    .addEdge('analyzeDependencies', 'createTasks')
    .addEdge('createTasks', 'createPlan')
    .addEdge('createPlan', '__end__');

  return graph.compile();
}

// Helper: Create basic tasks from debt items when LLM parsing fails
function createBasicTasks(debtItems: DebtFinding[]): RemediationTask[] {
  const severityPriority = { critical: 1, high: 3, medium: 5, low: 7, info: 9 };

  return debtItems.map((item) => ({
    id: uuidv4(),
    title: `Fix: ${item.title}`,
    description: item.description,
    relatedDebtIds: [item.id],
    estimatedEffort: estimateEffort(item),
    priority: severityPriority[item.severity],
    dependencies: [],
    suggestedApproach: item.suggestedFix || 'Review and refactor the identified code.',
    risks: ['Regression in related functionality'],
    acceptanceCriteria: ['Issue no longer present in code analysis'],
  }));
}

// Helper: Estimate effort based on debt type
function estimateEffort(item: DebtFinding): RemediationTask['estimatedEffort'] {
  switch (item.debtType) {
    case 'hardcoded_config':
    case 'missing_docs':
      return 'trivial';
    case 'code_smell':
    case 'dead_code':
      return 'small';
    case 'complexity':
    case 'duplication':
    case 'missing_tests':
      return 'medium';
    case 'god_class':
    case 'feature_envy':
    case 'circular_dependency':
      return 'large';
    case 'layer_violation':
    case 'security_issue':
      return 'xlarge';
    default:
      return 'medium';
  }
}

// Helper to run the planning agent
export async function runPlanningAgent(
  config: PlanningConfig,
  input: {
    repositoryId: string;
    scanId: string;
    debtItems: DebtFinding[];
  },
): Promise<{
  tasks: RemediationTask[];
  remediationPlan: RemediationPlan | null;
  errors: AgentError[];
}> {
  const graph = createPlanningGraph(config);

  const initialState: PlanningGraphState = {
    repositoryId: input.repositoryId,
    scanId: input.scanId,
    debtItems: input.debtItems,
    dependencies: [],
    tasks: [],
    remediationPlan: null,
    errors: [],
    shouldContinue: true,
  };

  const result = await graph.invoke(initialState);

  return {
    tasks: result.tasks,
    remediationPlan: result.remediationPlan,
    errors: result.errors,
  };
}
