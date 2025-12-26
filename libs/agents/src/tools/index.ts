import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ToolResult, FileInfo, GitContext } from '../types';

export interface ToolContext {
  repositoryId: string;
  repoPath: string;
  gitService: {
    getFileContent: (repoId: string, filePath: string) => Promise<string>;
    listFiles: (repoId: string, directory?: string) => Promise<Array<{ path: string; type: string }>>;
    getLog: (repoId: string, options?: { file?: string; limit?: number }) => Promise<GitContext[]>;
    getBlame: (repoId: string, filePath: string, startLine?: number, endLine?: number) => Promise<Array<{
      lineNumber: number;
      commitSha: string;
      authorName: string;
      authorEmail: string;
      date: Date;
      content: string;
    }>>;
    getDiff: (repoId: string, commitSha: string) => Promise<string>;
  };
  embeddingService?: {
    searchSimilar: (query: string, repositoryId: string, limit?: number) => Promise<Array<{
      filePath: string;
      content: string;
      similarity: number;
    }>>;
  };
}

// File Tools
export function createFileTools(context: ToolContext): DynamicStructuredTool[] {
  const readFileTool = new DynamicStructuredTool({
    name: 'read_file',
    description: 'Read the contents of a file in the repository',
    schema: z.object({
      filePath: z.string().describe('Path to the file relative to repository root'),
      startLine: z.number().optional().describe('Start line (1-indexed)'),
      endLine: z.number().optional().describe('End line (1-indexed)'),
    }),
    func: async ({ filePath, startLine, endLine }): Promise<string> => {
      try {
        const content = await context.gitService.getFileContent(context.repositoryId, filePath);

        if (startLine !== undefined || endLine !== undefined) {
          const lines = content.split('\n');
          const start = (startLine || 1) - 1;
          const end = endLine || lines.length;
          return lines.slice(start, end).join('\n');
        }

        return content;
      } catch (error) {
        return `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });

  const listDirectoryTool = new DynamicStructuredTool({
    name: 'list_directory',
    description: 'List files in a directory of the repository',
    schema: z.object({
      path: z.string().optional().describe('Directory path (empty for root)'),
      pattern: z.string().optional().describe('Glob pattern to filter files'),
    }),
    func: async ({ path, pattern }): Promise<string> => {
      try {
        const files = await context.gitService.listFiles(context.repositoryId, path || '');

        let result = files;
        if (pattern) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          result = files.filter(f => regex.test(f.path));
        }

        return JSON.stringify(result.slice(0, 100), null, 2);
      } catch (error) {
        return `Error listing directory: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });

  const searchCodeTool = new DynamicStructuredTool({
    name: 'search_code',
    description: 'Search for code patterns or text in the codebase using semantic similarity',
    schema: z.object({
      query: z.string().describe('Natural language query or code pattern to search for'),
      maxResults: z.number().optional().default(10).describe('Maximum number of results'),
    }),
    func: async ({ query, maxResults }): Promise<string> => {
      try {
        if (!context.embeddingService) {
          return 'Embedding service not available for semantic search';
        }

        const results = await context.embeddingService.searchSimilar(
          query,
          context.repositoryId,
          maxResults,
        );

        return JSON.stringify(results, null, 2);
      } catch (error) {
        return `Error searching code: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });

  return [readFileTool, listDirectoryTool, searchCodeTool];
}

// Git Tools
export function createGitTools(context: ToolContext): DynamicStructuredTool[] {
  const gitLogTool = new DynamicStructuredTool({
    name: 'git_log',
    description: 'Get git commit history for a file or the entire repository',
    schema: z.object({
      filePath: z.string().optional().describe('Path to file (optional, for file-specific history)'),
      limit: z.number().optional().default(20).describe('Maximum number of commits'),
    }),
    func: async ({ filePath, limit }): Promise<string> => {
      try {
        const log = await context.gitService.getLog(context.repositoryId, {
          file: filePath,
          limit,
        });

        return JSON.stringify(log, null, 2);
      } catch (error) {
        return `Error getting git log: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });

  const gitBlameTool = new DynamicStructuredTool({
    name: 'git_blame',
    description: 'Get blame information for specific lines in a file',
    schema: z.object({
      filePath: z.string().describe('Path to the file'),
      startLine: z.number().describe('Start line number'),
      endLine: z.number().describe('End line number'),
    }),
    func: async ({ filePath, startLine, endLine }): Promise<string> => {
      try {
        const blame = await context.gitService.getBlame(
          context.repositoryId,
          filePath,
          startLine,
          endLine,
        );

        return JSON.stringify(blame, null, 2);
      } catch (error) {
        return `Error getting blame: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });

  const gitDiffTool = new DynamicStructuredTool({
    name: 'git_diff',
    description: 'Get the diff for a specific commit',
    schema: z.object({
      commitSha: z.string().describe('Commit SHA to get diff for'),
    }),
    func: async ({ commitSha }): Promise<string> => {
      try {
        const diff = await context.gitService.getDiff(context.repositoryId, commitSha);
        return diff;
      } catch (error) {
        return `Error getting diff: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });

  return [gitLogTool, gitBlameTool, gitDiffTool];
}

// Analysis Tools
export function createAnalysisTools(): DynamicStructuredTool[] {
  const reportDebtTool = new DynamicStructuredTool({
    name: 'report_debt',
    description: 'Report a technical debt finding',
    schema: z.object({
      debtType: z.enum([
        'code_smell', 'complexity', 'duplication', 'dead_code',
        'circular_dependency', 'layer_violation', 'god_class', 'feature_envy',
        'hardcoded_config', 'security_issue', 'missing_tests', 'missing_docs',
      ]).describe('Type of technical debt'),
      severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).describe('Severity level'),
      title: z.string().describe('Short title for the finding'),
      description: z.string().describe('Detailed description'),
      filePath: z.string().describe('File where the issue was found'),
      startLine: z.number().nullable().describe('Start line of the issue'),
      endLine: z.number().nullable().describe('End line of the issue'),
      evidence: z.array(z.string()).describe('Code snippets or patterns as evidence'),
      suggestedFix: z.string().nullable().describe('How to fix the issue'),
      confidence: z.number().min(0).max(1).describe('Confidence score (0-1)'),
    }),
    func: async (finding): Promise<string> => {
      // This tool is used to collect findings - the actual storage happens in the agent
      return JSON.stringify({ reported: true, finding });
    },
  });

  return [reportDebtTool];
}

// Reflection Tools
export function createReflectionTools(): DynamicStructuredTool[] {
  const validateFindingTool = new DynamicStructuredTool({
    name: 'validate_finding',
    description: 'Validate a finding and adjust its confidence',
    schema: z.object({
      findingId: z.string().describe('ID of the finding to validate'),
      isValid: z.boolean().describe('Whether the finding is valid'),
      adjustedConfidence: z.number().min(0).max(1).describe('Adjusted confidence score'),
      reason: z.string().describe('Reason for the validation decision'),
    }),
    func: async (validation): Promise<string> => {
      return JSON.stringify({ validated: true, ...validation });
    },
  });

  const rejectFindingTool = new DynamicStructuredTool({
    name: 'reject_finding',
    description: 'Reject a finding as false positive',
    schema: z.object({
      findingId: z.string().describe('ID of the finding to reject'),
      reason: z.string().describe('Reason for rejection'),
    }),
    func: async (rejection): Promise<string> => {
      return JSON.stringify({ rejected: true, ...rejection });
    },
  });

  return [validateFindingTool, rejectFindingTool];
}

// Create all tools for an agent
export function createAllTools(context: ToolContext): DynamicStructuredTool[] {
  return [
    ...createFileTools(context),
    ...createGitTools(context),
    ...createAnalysisTools(),
    ...createReflectionTools(),
  ];
}
