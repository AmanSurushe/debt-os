# DEBT-OS Technical Specification (Phases 0-5)

## Technology Stack

| Layer | Choice |
|-------|--------|
| Backend Framework | NestJS (TypeScript) |
| Database | PostgreSQL 16 + pgvector |
| ORM | TypeORM |
| Queue | BullMQ + Redis |
| Agent Framework | LangGraph (TypeScript) |
| LLM Providers | OpenAI + Anthropic (abstracted) |
| Auth | JWT (API/CLI) + Sessions (Dashboard) |
| Static Analysis | None initially (pure LLM) |
| Deployment | Docker Compose |

---

## Phase 0: Software Engineering Foundations

### 0.1 Project Structure

```
debt-os/
├── apps/
│   └── api/                    # NestJS application
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── config/         # Configuration module
│       │   ├── common/         # Shared utilities, guards, interceptors
│       │   ├── modules/
│       │   │   ├── repo/       # Repository management
│       │   │   ├── scan/       # Scan orchestration
│       │   │   ├── debt/       # Debt item management
│       │   │   ├── webhook/    # GitHub/GitLab webhooks
│       │   │   ├── auth/       # OAuth + API keys
│       │   │   └── health/     # Health checks
│       │   └── database/       # TypeORM config, migrations
│       └── test/
├── libs/
│   ├── agents/                 # LangGraph agents (Phase 3+)
│   ├── llm/                    # LLM abstraction layer
│   ├── embeddings/             # Embedding generation
│   ├── memory/                 # Memory systems
│   ├── analyzers/              # Static analysis wrappers
│   └── git/                    # Git operations library
├── cli/                        # CLI tool (future)
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   └── init-scripts/
└── docs/
```

### 0.2 Data Models

#### Core Entities

```typescript
// Repository - a connected codebase
interface Repository {
  id: string;                    // UUID
  externalId: string;            // GitHub/GitLab ID
  provider: 'github' | 'gitlab';
  owner: string;
  name: string;
  fullName: string;              // owner/name
  defaultBranch: string;
  cloneUrl: string;
  webhookId: string | null;
  webhookSecret: string | null;
  lastSyncedAt: Date | null;
  settings: RepositorySettings;
  createdAt: Date;
  updatedAt: Date;
}

interface RepositorySettings {
  autoScan: boolean;
  scanOnPush: boolean;
  scanOnPr: boolean;
  excludePaths: string[];
  includePaths: string[];
}

// Scan - a single analysis run
interface Scan {
  id: string;
  repositoryId: string;
  commitSha: string;
  branch: string;
  status: 'pending' | 'ingesting' | 'analyzing' | 'complete' | 'failed';
  triggeredBy: 'manual' | 'webhook' | 'schedule';
  triggeredById: string | null;  // User or webhook ID
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  stats: ScanStats;
  createdAt: Date;
}

interface ScanStats {
  filesAnalyzed: number;
  debtItemsFound: number;
  totalTokensUsed: number;
  totalCost: number;
  durationMs: number;
}

// DebtItem - a detected piece of technical debt
interface DebtItem {
  id: string;
  scanId: string;
  repositoryId: string;

  // Location
  filePath: string;
  startLine: number | null;
  endLine: number | null;

  // Classification
  debtType: DebtType;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: number;            // 0.0 - 1.0

  // Description
  title: string;
  description: string;
  evidence: string[];            // Code snippets, patterns found

  // Context (from git history)
  introducedInCommit: string | null;
  introducedAt: Date | null;
  introducedBy: string | null;

  // Remediation
  suggestedFix: string | null;
  estimatedEffort: 'trivial' | 'small' | 'medium' | 'large' | 'xlarge' | null;

  // Tracking
  status: 'open' | 'acknowledged' | 'planned' | 'in_progress' | 'resolved' | 'wont_fix';
  fingerprint: string;           // For deduplication across scans

  createdAt: Date;
  updatedAt: Date;
}

enum DebtType {
  // Code-level
  CODE_SMELL = 'code_smell',
  COMPLEXITY = 'complexity',
  DUPLICATION = 'duplication',
  DEAD_CODE = 'dead_code',

  // Architectural
  CIRCULAR_DEPENDENCY = 'circular_dependency',
  LAYER_VIOLATION = 'layer_violation',
  GOD_CLASS = 'god_class',
  FEATURE_ENVY = 'feature_envy',

  // Dependency
  OUTDATED_DEPENDENCY = 'outdated_dependency',
  VULNERABLE_DEPENDENCY = 'vulnerable_dependency',
  MISSING_LOCK_FILE = 'missing_lock_file',

  // Testing
  LOW_COVERAGE = 'low_coverage',
  MISSING_TESTS = 'missing_tests',
  FLAKY_TESTS = 'flaky_tests',

  // Documentation
  MISSING_DOCS = 'missing_docs',
  OUTDATED_DOCS = 'outdated_docs',

  // Infrastructure
  HARDCODED_CONFIG = 'hardcoded_config',
  SECURITY_ISSUE = 'security_issue',
}
```

#### Supporting Entities

```typescript
// FileSnapshot - state of a file at scan time
interface FileSnapshot {
  id: string;
  scanId: string;
  filePath: string;
  contentHash: string;
  language: string | null;
  lineCount: number;
  sizeBytes: number;
  embedding: number[];           // pgvector
  analyzedAt: Date | null;
}

// CommitInfo - commit metadata for context
interface CommitInfo {
  id: string;
  repositoryId: string;
  sha: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authoredAt: Date;
  embedding: number[];           // pgvector
}

// User - for auth and tracking
interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  provider: 'github' | 'gitlab';
  providerId: string;
  accessToken: string;           // Encrypted
  refreshToken: string | null;   // Encrypted
  createdAt: Date;
  updatedAt: Date;
}
```

### 0.3 API Contracts

#### Repository Management

```
POST   /api/repos                    # Connect a repository
GET    /api/repos                    # List connected repos
GET    /api/repos/:id                # Get repo details
PATCH  /api/repos/:id                # Update repo settings
DELETE /api/repos/:id                # Disconnect repo

POST   /api/repos/:id/sync           # Trigger manual sync
GET    /api/repos/:id/stats          # Get repo debt statistics
```

**Request/Response Examples:**

```typescript
// POST /api/repos
// Request:
{
  "provider": "github",
  "fullName": "owner/repo-name",
  "installWebhook": true
}

// Response:
{
  "id": "uuid",
  "provider": "github",
  "fullName": "owner/repo-name",
  "defaultBranch": "main",
  "webhookInstalled": true,
  "status": "connected",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

#### Scan Operations

```
POST   /api/repos/:id/scans          # Trigger scan
GET    /api/repos/:id/scans          # List scans for repo
GET    /api/scans/:id                # Get scan details
GET    /api/scans/:id/progress       # SSE stream for progress
DELETE /api/scans/:id                # Cancel running scan
```

```typescript
// POST /api/repos/:id/scans
// Request:
{
  "branch": "main",           // Optional, defaults to default branch
  "commitSha": "abc123",      // Optional, defaults to HEAD
  "analysisDepth": "full"     // 'quick' | 'standard' | 'full'
}

// Response:
{
  "id": "scan-uuid",
  "status": "pending",
  "repositoryId": "repo-uuid",
  "branch": "main",
  "commitSha": "abc123def456...",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

#### Debt Items

```
GET    /api/repos/:id/debt           # List debt items for repo
GET    /api/scans/:id/debt           # List debt items for scan
GET    /api/debt/:id                 # Get debt item details
PATCH  /api/debt/:id                 # Update status
GET    /api/debt/:id/history         # Get item history across scans

GET    /api/repos/:id/debt/trends    # Debt trends over time
GET    /api/repos/:id/debt/hotspots  # Files with most debt
```

```typescript
// GET /api/repos/:id/debt?type=architectural&severity=high,critical
// Response:
{
  "items": [
    {
      "id": "debt-uuid",
      "type": "circular_dependency",
      "severity": "high",
      "confidence": 0.92,
      "title": "Circular dependency between auth and user modules",
      "filePath": "src/modules/auth/auth.service.ts",
      "startLine": 15,
      "endLine": 45,
      "status": "open",
      "firstSeenAt": "2024-01-10T08:00:00Z",
      "scanCount": 3
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 47
  },
  "filters": {
    "types": ["circular_dependency"],
    "severities": ["high", "critical"]
  }
}
```

#### Webhooks

```
POST   /api/webhooks/github          # GitHub webhook receiver
POST   /api/webhooks/gitlab          # GitLab webhook receiver
```

### 0.4 Authentication

```typescript
// Dual auth strategy: JWT for API/CLI, Sessions for Dashboard

// JWT Strategy (API/CLI)
interface JWTPayload {
  sub: string;          // User ID
  email: string;
  iat: number;
  exp: number;
}

// API Key for programmatic access
interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyHash: string;      // bcrypt hash of the key
  prefix: string;       // First 8 chars for identification
  scopes: string[];     // ['read', 'write', 'admin']
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

// Auth endpoints
// POST /api/auth/github          # GitHub OAuth login
// POST /api/auth/gitlab          # GitLab OAuth login
// POST /api/auth/refresh         # Refresh JWT
// POST /api/auth/logout          # Invalidate session
// GET  /api/auth/me              # Current user

// API Key endpoints
// POST   /api/api-keys           # Create API key
// GET    /api/api-keys           # List API keys
// DELETE /api/api-keys/:id       # Revoke API key
```

### 0.5 Background Jobs

Using BullMQ with Redis:

```typescript
// Queue definitions
const queues = {
  'repo-sync': {
    // Clone/pull repository, update file list
    jobs: ['sync-repo', 'update-file-tree']
  },
  'scan': {
    // Orchestrate scan phases
    jobs: ['start-scan', 'ingest-files', 'run-analysis', 'finalize-scan']
  },
  'analysis': {
    // Individual file/component analysis
    jobs: ['analyze-file', 'analyze-architecture', 'analyze-dependencies']
  },
  'embedding': {
    // Generate embeddings
    jobs: ['embed-file', 'embed-commit', 'embed-debt-item']
  }
};

// Job priorities
// 1 = highest priority (webhooks, user-triggered)
// 10 = lowest priority (background maintenance)
```

### 0.6 System Integration Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        DEBT-OS API (NestJS)                     │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│   Repo      │    Scan     │    Debt     │   Webhook   │  Auth   │
│   Module    │   Module    │   Module    │   Module    │  Module │
├─────────────┴─────────────┴─────────────┴─────────────┴─────────┤
│                         Service Layer                            │
├──────────────────────────────────────────────────────────────────┤
│                        Queue Processor                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │repo-sync │  │  scan    │  │ analysis │  │embedding │         │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
├──────────────────────────────────────────────────────────────────┤
│                         Data Layer                               │
│  ┌─────────────────────┐    ┌─────────────────────┐             │
│  │   PostgreSQL        │    │      Redis          │             │
│  │   + pgvector        │    │   (Queue + Cache)   │             │
│  └─────────────────────┘    └─────────────────────┘             │
└──────────────────────────────────────────────────────────────────┘
            │                           │
            ▼                           ▼
    ┌───────────────┐           ┌───────────────┐
    │  Local Clone  │           │  GitHub API   │
    │  (File System)│           │  GitLab API   │
    └───────────────┘           └───────────────┘
```

---

## Phase 1: AI & ML Foundations

### 1.1 Embedding Strategy

```typescript
// libs/embeddings/src/types.ts

interface EmbeddingConfig {
  model: 'text-embedding-3-small' | 'text-embedding-3-large';
  dimensions: 1536 | 3072;
  chunkSize: number;
  chunkOverlap: number;
}

// Different strategies for different content types
const embeddingStrategies = {
  sourceFile: {
    model: 'text-embedding-3-small',
    dimensions: 1536,
    chunkSize: 1500,      // ~tokens
    chunkOverlap: 200,
    preprocessing: 'code'  // Remove comments? Keep structure?
  },
  commit: {
    model: 'text-embedding-3-small',
    dimensions: 1536,
    chunkSize: 500,
    chunkOverlap: 50,
    preprocessing: 'text'
  },
  debtItem: {
    model: 'text-embedding-3-small',
    dimensions: 1536,
    // Embed: title + description + evidence concatenated
  }
};
```

### 1.2 Chunking Implementation

```typescript
// libs/embeddings/src/chunker.ts

interface Chunk {
  id: string;
  content: string;
  metadata: {
    fileId: string;
    filePath: string;
    startLine: number;
    endLine: number;
    language: string;
    type: 'function' | 'class' | 'module' | 'block';
  };
}

// Code-aware chunking strategies
interface ChunkingStrategy {
  // Prefer semantic boundaries (functions, classes)
  semantic: boolean;

  // Fall back to line-based for large functions
  maxChunkLines: number;

  // Include context (imports, class declaration)
  includeContext: boolean;
}
```

### 1.3 pgvector Schema

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- File embeddings table
CREATE TABLE file_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_snapshot_id UUID NOT NULL REFERENCES file_snapshots(id),
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(file_snapshot_id, chunk_index)
);

-- Create HNSW index for fast similarity search
CREATE INDEX ON file_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Commit embeddings
CREATE TABLE commit_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commit_info_id UUID NOT NULL REFERENCES commit_info(id),
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON commit_embeddings
  USING hnsw (embedding vector_cosine_ops);
```

### 1.4 Similarity Search API

```typescript
// libs/embeddings/src/search.ts

interface SimilaritySearchOptions {
  query: string;                    // Natural language or code
  repositoryId: string;
  limit?: number;                   // Default 10
  threshold?: number;               // Minimum similarity (0-1)
  filters?: {
    fileTypes?: string[];           // ['ts', 'js']
    paths?: string[];               // Glob patterns
    scanId?: string;                // Specific scan
  };
}

interface SimilarityResult {
  fileSnapshotId: string;
  filePath: string;
  chunkContent: string;
  startLine: number;
  endLine: number;
  similarity: number;
}

// Example queries:
// - "Find files with authentication logic"
// - "Show code similar to this function: [code]"
// - "Find patterns like circular imports"
```

---

## Phase 2: LLM Mastery

### 2.1 LLM Abstraction Layer

```typescript
// libs/llm/src/provider.ts

interface LLMProvider {
  name: 'openai' | 'anthropic';

  complete(request: CompletionRequest): Promise<CompletionResponse>;

  completeStructured<T>(
    request: CompletionRequest,
    schema: z.ZodSchema<T>
  ): Promise<T>;

  stream(request: CompletionRequest): AsyncIterable<StreamChunk>;

  countTokens(text: string): number;
}

interface CompletionRequest {
  model: string;
  systemPrompt?: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'required' | { name: string };
}

interface CompletionResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
  };
  finishReason: 'stop' | 'tool_calls' | 'length';
}
```

### 2.2 Model Configuration

```typescript
// libs/llm/src/models.ts

const modelConfigs = {
  // Fast, cheap - for simple classification
  'gpt-4o-mini': {
    provider: 'openai',
    contextWindow: 128000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    bestFor: ['classification', 'simple-extraction']
  },

  // Balanced - for most analysis
  'gpt-4o': {
    provider: 'openai',
    contextWindow: 128000,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
    bestFor: ['code-analysis', 'reasoning']
  },

  // Deep reasoning - for architecture
  'claude-3-5-sonnet': {
    provider: 'anthropic',
    contextWindow: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    bestFor: ['architecture', 'complex-reasoning']
  },

  // Deep analysis
  'claude-opus-4': {
    provider: 'anthropic',
    contextWindow: 200000,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    bestFor: ['deep-analysis', 'planning']
  }
};

// Model selection strategy
function selectModel(task: AnalysisTask): string {
  switch (task.type) {
    case 'file-classification':
      return 'gpt-4o-mini';
    case 'debt-detection':
      return 'gpt-4o';
    case 'architecture-analysis':
      return 'claude-3-5-sonnet';
    case 'remediation-planning':
      return 'claude-opus-4';
  }
}
```

### 2.3 Prompt Templates

```typescript
// libs/llm/src/prompts/debt-analysis.ts

const FILE_ANALYSIS_SYSTEM = `You are a senior software engineer analyzing code for technical debt.

Your task is to identify technical debt in the provided code file. Consider:
- Code smells (long methods, deep nesting, magic numbers)
- Design issues (god classes, feature envy, inappropriate intimacy)
- Maintainability concerns (poor naming, missing abstractions)
- Potential bugs or security issues

Be precise and actionable. Only flag genuine issues, not stylistic preferences.`;

const FILE_ANALYSIS_USER = `Analyze this {{language}} file for technical debt:

File: {{filePath}}
\`\`\`{{language}}
{{content}}
\`\`\`

{{#if relatedContext}}
Related context:
{{relatedContext}}
{{/if}}

Identify any technical debt. For each item, provide:
1. Type of debt
2. Severity (critical/high/medium/low/info)
3. Location (line numbers)
4. Description of the issue
5. Why it's problematic
6. Suggested fix`;

// Structured output schema
const DebtFindingSchema = z.object({
  findings: z.array(z.object({
    debtType: z.enum([
      'code_smell', 'complexity', 'duplication', 'dead_code',
      'circular_dependency', 'layer_violation', 'god_class',
      'feature_envy', 'hardcoded_config', 'security_issue',
      'missing_tests', 'missing_docs'
    ]),
    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
    title: z.string().max(100),
    description: z.string().max(500),
    startLine: z.number().nullable(),
    endLine: z.number().nullable(),
    evidence: z.array(z.string()),
    suggestedFix: z.string().nullable(),
    confidence: z.number().min(0).max(1)
  })),
  overallAssessment: z.string().max(300),
  fileHealthScore: z.number().min(0).max(100)
});
```

### 2.4 Token Budgeting

```typescript
// libs/llm/src/budget.ts

interface TokenBudget {
  maxInputTokens: number;
  maxOutputTokens: number;
  reserveForTools: number;
  reserveForContext: number;
}

const budgets: Record<string, TokenBudget> = {
  'file-analysis': {
    maxInputTokens: 8000,      // File content + context
    maxOutputTokens: 2000,     // Analysis output
    reserveForTools: 500,
    reserveForContext: 1500    // Related files, imports
  },
  'architecture-analysis': {
    maxInputTokens: 32000,     // Multiple files, structure
    maxOutputTokens: 4000,
    reserveForTools: 1000,
    reserveForContext: 4000
  }
};

// Truncation strategy for large files
function fitToTokenBudget(
  content: string,
  budget: number,
  strategy: 'head' | 'tail' | 'smart'
): string {
  // 'smart' keeps imports, class declarations, and samples from body
}
```

---

## Phase 3: Agentic AI Fundamentals

### 3.1 LangGraph Agent Architecture

```typescript
// libs/agents/src/types.ts

interface AgentState {
  // Current analysis context
  repositoryId: string;
  scanId: string;
  currentPhase: 'ingestion' | 'analysis' | 'synthesis' | 'planning';

  // Working memory
  filesAnalyzed: string[];
  debtItemsFound: DebtItem[];
  architectureInsights: ArchitectureInsight[];

  // Shared context
  repoContext: RepoContext;

  // Control flow
  errors: AgentError[];
  shouldContinue: boolean;
}

interface RepoContext {
  structure: FileTree;
  languages: LanguageBreakdown;
  frameworks: string[];
  entryPoints: string[];
  dependencyGraph: DependencyGraph;
}
```

### 3.2 Agent Definitions

#### Analyzer Agent

```typescript
// libs/agents/src/analyzer/graph.ts

const analyzerGraph = new StateGraph<AnalyzerState>({
  channels: {
    files: { value: [] },
    findings: { value: [] },
    currentFile: { value: null },
    phase: { value: 'selecting' }
  }
})
  .addNode('selectNextFile', selectNextFileNode)
  .addNode('analyzeFile', analyzeFileNode)
  .addNode('validateFindings', validateFindingsNode)
  .addNode('synthesize', synthesizeNode)
  .addEdge('__start__', 'selectNextFile')
  .addConditionalEdges('selectNextFile', shouldAnalyze, {
    analyze: 'analyzeFile',
    done: 'synthesize'
  })
  .addEdge('analyzeFile', 'validateFindings')
  .addEdge('validateFindings', 'selectNextFile')
  .addEdge('synthesize', '__end__');

// Tool definitions for Analyzer Agent
const analyzerTools = [
  {
    name: 'read_file',
    description: 'Read contents of a file in the repository',
    parameters: z.object({
      filePath: z.string(),
      startLine: z.number().optional(),
      endLine: z.number().optional()
    })
  },
  {
    name: 'search_codebase',
    description: 'Search for patterns or text in the codebase',
    parameters: z.object({
      query: z.string(),
      fileTypes: z.array(z.string()).optional(),
      maxResults: z.number().default(10)
    })
  },
  {
    name: 'get_file_dependencies',
    description: 'Get import/require dependencies of a file',
    parameters: z.object({
      filePath: z.string()
    })
  },
  {
    name: 'report_debt',
    description: 'Report a technical debt finding',
    parameters: DebtFindingSchema
  }
];
```

#### Context Agent

```typescript
// libs/agents/src/context/graph.ts

const contextAgentGraph = new StateGraph<ContextState>({
  channels: {
    targetFile: { value: null },
    gitHistory: { value: [] },
    relatedChanges: { value: [] },
    contextReport: { value: null }
  }
})
  .addNode('fetchGitHistory', fetchGitHistoryNode)
  .addNode('analyzeChanges', analyzeChangesNode)
  .addNode('findRelatedChanges', findRelatedChangesNode)
  .addNode('synthesizeContext', synthesizeContextNode)
  .addEdge('__start__', 'fetchGitHistory')
  .addEdge('fetchGitHistory', 'analyzeChanges')
  .addEdge('analyzeChanges', 'findRelatedChanges')
  .addEdge('findRelatedChanges', 'synthesizeContext')
  .addEdge('synthesizeContext', '__end__');

const contextTools = [
  {
    name: 'git_log',
    description: 'Get git commit history for a file',
    parameters: z.object({
      filePath: z.string(),
      limit: z.number().default(20)
    })
  },
  {
    name: 'git_blame',
    description: 'Get blame information for specific lines',
    parameters: z.object({
      filePath: z.string(),
      startLine: z.number(),
      endLine: z.number()
    })
  },
  {
    name: 'get_commit_diff',
    description: 'Get the diff for a specific commit',
    parameters: z.object({
      commitSha: z.string()
    })
  },
  {
    name: 'find_related_commits',
    description: 'Find commits that touched similar files',
    parameters: z.object({
      filePaths: z.array(z.string()),
      limit: z.number().default(10)
    })
  }
];
```

#### Reflection Agent

```typescript
// libs/agents/src/reflection/graph.ts

const reflectionAgentGraph = new StateGraph<ReflectionState>({
  channels: {
    findings: { value: [] },
    validatedFindings: { value: [] },
    rejectedFindings: { value: [] },
    confidenceAdjustments: { value: {} }
  }
})
  .addNode('reviewFinding', reviewFindingNode)
  .addNode('checkFalsePositive', checkFalsePositiveNode)
  .addNode('adjustConfidence', adjustConfidenceNode)
  .addNode('finalizeFindings', finalizeFindingsNode)
  .addEdge('__start__', 'reviewFinding')
  .addConditionalEdges('reviewFinding', hasMoreFindings, {
    continue: 'checkFalsePositive',
    done: 'finalizeFindings'
  })
  .addEdge('checkFalsePositive', 'adjustConfidence')
  .addEdge('adjustConfidence', 'reviewFinding')
  .addEdge('finalizeFindings', '__end__');

// Reflection prompts
const REFLECTION_SYSTEM = `You are a critical reviewer of technical debt findings.

Your job is to validate findings and filter out false positives. Consider:
- Is this actually debt, or an intentional design choice?
- Is the evidence sufficient?
- Could this be a false pattern match?
- What's the actual impact on maintainability?

Be skeptical but fair. Real debt should be flagged; spurious findings should be rejected.`;

const reflectionTools = [
  {
    name: 'verify_pattern',
    description: 'Check if a detected pattern is actually problematic',
    parameters: z.object({
      findingId: z.string(),
      verificationSteps: z.array(z.string())
    })
  },
  {
    name: 'check_intentional_design',
    description: 'Check if the pattern might be intentional',
    parameters: z.object({
      filePath: z.string(),
      pattern: z.string()
    })
  },
  {
    name: 'adjust_confidence',
    description: 'Adjust confidence score based on verification',
    parameters: z.object({
      findingId: z.string(),
      newConfidence: z.number(),
      reason: z.string()
    })
  },
  {
    name: 'reject_finding',
    description: 'Mark a finding as false positive',
    parameters: z.object({
      findingId: z.string(),
      reason: z.string()
    })
  }
];
```

#### Planning Agent

```typescript
// libs/agents/src/planning/graph.ts

const planningAgentGraph = new StateGraph<PlanningState>({
  channels: {
    debtItems: { value: [] },
    dependencies: { value: [] },
    remediationPlan: { value: null },
    tasks: { value: [] }
  }
})
  .addNode('prioritizeDebt', prioritizeDebtNode)
  .addNode('identifyDependencies', identifyDependenciesNode)
  .addNode('groupRelatedItems', groupRelatedItemsNode)
  .addNode('createTasks', createTasksNode)
  .addNode('estimateEffort', estimateEffortNode)
  .addNode('generatePlan', generatePlanNode)
  .addEdge('__start__', 'prioritizeDebt')
  .addEdge('prioritizeDebt', 'identifyDependencies')
  .addEdge('identifyDependencies', 'groupRelatedItems')
  .addEdge('groupRelatedItems', 'createTasks')
  .addEdge('createTasks', 'estimateEffort')
  .addEdge('estimateEffort', 'generatePlan')
  .addEdge('generatePlan', '__end__');

interface RemediationTask {
  id: string;
  title: string;
  description: string;
  relatedDebtIds: string[];
  estimatedEffort: 'trivial' | 'small' | 'medium' | 'large' | 'xlarge';
  priority: number;               // 1-10
  dependencies: string[];         // Other task IDs
  suggestedApproach: string;
  risks: string[];
  acceptanceCriteria: string[];
}

interface RemediationPlan {
  id: string;
  scanId: string;
  summary: string;
  totalDebtItems: number;
  prioritizedTasks: RemediationTask[];
  quickWins: RemediationTask[];   // Low effort, high impact
  strategicWork: RemediationTask[]; // High effort, high impact
  deferrable: RemediationTask[];  // Low priority
}
```

### 3.3 Agent Orchestration

```typescript
// libs/agents/src/orchestrator.ts

interface ScanOrchestrator {
  // Main entry point for a scan
  async runScan(scanId: string): Promise<ScanResult>;
}

// Orchestration flow
const orchestratorGraph = new StateGraph<OrchestratorState>({
  channels: {
    phase: { value: 'init' },
    analyzerResults: { value: [] },
    contextResults: { value: [] },
    reflectionResults: { value: [] },
    planningResults: { value: null }
  }
})
  // Phase 1: Initial analysis
  .addNode('runAnalyzers', async (state) => {
    // Run analyzer agents in parallel for each file batch
    const results = await Promise.all(
      state.fileBatches.map(batch =>
        analyzerGraph.invoke({ files: batch })
      )
    );
    return { analyzerResults: results.flat() };
  })

  // Phase 2: Add git context
  .addNode('enrichContext', async (state) => {
    // Run context agent for each finding that needs history
    const results = await Promise.all(
      state.analyzerResults
        .filter(f => f.needsContext)
        .map(f => contextAgentGraph.invoke({ targetFile: f.filePath }))
    );
    return { contextResults: results };
  })

  // Phase 3: Validate findings
  .addNode('reflectOnFindings', async (state) => {
    const results = await reflectionAgentGraph.invoke({
      findings: state.analyzerResults
    });
    return { reflectionResults: results };
  })

  // Phase 4: Create plan
  .addNode('createPlan', async (state) => {
    const plan = await planningAgentGraph.invoke({
      debtItems: state.reflectionResults.validatedFindings
    });
    return { planningResults: plan };
  })

  .addEdge('__start__', 'runAnalyzers')
  .addEdge('runAnalyzers', 'enrichContext')
  .addEdge('enrichContext', 'reflectOnFindings')
  .addEdge('reflectOnFindings', 'createPlan')
  .addEdge('createPlan', '__end__');
```

---

## Phase 4: Memory, Tools & Knowledge

### 4.1 Memory System Architecture

```typescript
// libs/memory/src/types.ts

interface MemorySystem {
  episodic: EpisodicMemory;   // Past events, scans, interactions
  semantic: SemanticMemory;    // Knowledge, patterns, rules
  temporal: TemporalMemory;    // Trends over time
}

// Episodic Memory - what happened
interface EpisodicMemory {
  // Store scan results
  storeScan(scan: ScanResult): Promise<void>;

  // Retrieve past scans for a repo
  getRepoHistory(repoId: string, limit?: number): Promise<ScanSummary[]>;

  // Store team feedback
  storeFeedback(feedback: UserFeedback): Promise<void>;

  // Get feedback history for similar findings
  getFeedbackForPattern(pattern: DebtPattern): Promise<UserFeedback[]>;
}

// Semantic Memory - what we know
interface SemanticMemory {
  // Store known debt patterns
  storePattern(pattern: DebtPattern): Promise<void>;

  // Find similar patterns
  findSimilarPatterns(embedding: number[]): Promise<DebtPattern[]>;

  // Store architecture rules
  storeRule(rule: ArchitectureRule): Promise<void>;

  // Get rules for a context
  getRulesFor(context: AnalysisContext): Promise<ArchitectureRule[]>;
}

// Temporal Memory - how things change
interface TemporalMemory {
  // Track debt item over time
  trackDebtItem(fingerprint: string, scanId: string, status: DebtStatus): Promise<void>;

  // Get trend for a debt item
  getDebtTrend(fingerprint: string): Promise<DebtTrend>;

  // Get repo-level trends
  getRepoTrends(repoId: string, timeRange: TimeRange): Promise<RepoTrends>;
}
```

### 4.2 Database Schema for Memory

```sql
-- Episodic Memory Tables

CREATE TABLE scan_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES scans(id),
  repository_id UUID NOT NULL REFERENCES repositories(id),

  total_debt_items INTEGER NOT NULL,
  critical_count INTEGER NOT NULL,
  high_count INTEGER NOT NULL,
  medium_count INTEGER NOT NULL,
  low_count INTEGER NOT NULL,

  top_issues JSONB NOT NULL,        -- Top 5 issues summary
  health_score FLOAT NOT NULL,       -- 0-100

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_item_id UUID REFERENCES debt_items(id),
  user_id UUID NOT NULL REFERENCES users(id),

  action: TEXT NOT NULL,             -- 'accepted', 'rejected', 'deferred'
  reason TEXT,

  -- For learning
  finding_fingerprint TEXT NOT NULL,
  finding_type TEXT NOT NULL,
  was_accurate BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Semantic Memory Tables

CREATE TABLE debt_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  description TEXT NOT NULL,
  detection_strategy TEXT NOT NULL,  -- How to detect

  -- For similarity matching
  embedding vector(1536) NOT NULL,

  -- Metadata
  false_positive_rate FLOAT,
  occurrences_seen INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON debt_patterns
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE architecture_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID REFERENCES repositories(id), -- NULL = global

  name TEXT NOT NULL,
  description TEXT NOT NULL,
  rule_type TEXT NOT NULL,           -- 'layer', 'dependency', 'naming', etc.

  condition JSONB NOT NULL,          -- Rule definition
  severity TEXT NOT NULL,

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Temporal Memory Tables

CREATE TABLE debt_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  repository_id UUID NOT NULL REFERENCES repositories(id),
  scan_id UUID NOT NULL REFERENCES scans(id),

  status TEXT NOT NULL,              -- 'new', 'existing', 'resolved', 'regressed'
  severity TEXT NOT NULL,

  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,

  scan_count INTEGER DEFAULT 1,      -- How many scans it appeared in

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_debt_tracking_fingerprint ON debt_tracking(fingerprint);
CREATE INDEX idx_debt_tracking_repo_time ON debt_tracking(repository_id, created_at);
```

### 4.3 RAG Implementation

```typescript
// libs/memory/src/rag.ts

interface RAGContext {
  // Retrieve relevant context for analysis
  async getContextFor(query: AnalysisQuery): Promise<RetrievedContext>;
}

interface AnalysisQuery {
  type: 'file_analysis' | 'architecture' | 'pattern_match';
  content: string;                    // File content or query
  repositoryId: string;
  additionalContext?: {
    filePath?: string;
    language?: string;
    relatedFiles?: string[];
  };
}

interface RetrievedContext {
  // Similar code patterns from other files
  similarCode: CodeChunk[];

  // Past findings for similar code
  relatedFindings: DebtItem[];

  // Team feedback on similar patterns
  teamFeedback: UserFeedback[];

  // Architecture rules that apply
  applicableRules: ArchitectureRule[];

  // Historical trends
  relevantTrends: DebtTrend[];
}

// RAG Pipeline
class DebtRAG implements RAGContext {
  async getContextFor(query: AnalysisQuery): Promise<RetrievedContext> {
    // 1. Generate embedding for query
    const embedding = await this.embedder.embed(query.content);

    // 2. Parallel retrieval
    const [
      similarCode,
      relatedFindings,
      teamFeedback,
      applicableRules
    ] = await Promise.all([
      this.searchSimilarCode(embedding, query),
      this.searchRelatedFindings(embedding, query),
      this.getTeamFeedback(embedding, query),
      this.getApplicableRules(query)
    ]);

    // 3. Rank and filter
    return this.rankAndFilter({
      similarCode,
      relatedFindings,
      teamFeedback,
      applicableRules
    });
  }
}
```

### 4.4 Tools Library

```typescript
// libs/agents/src/tools/index.ts

// File System Tools
const fileTools = {
  readFile: createTool({
    name: 'read_file',
    execute: async ({ filePath, startLine, endLine }) => {
      // Read from local clone
    }
  }),

  listDirectory: createTool({
    name: 'list_directory',
    execute: async ({ path, recursive, pattern }) => {
      // List files matching pattern
    }
  }),

  searchCode: createTool({
    name: 'search_code',
    execute: async ({ query, fileTypes, maxResults }) => {
      // Ripgrep-based search
    }
  })
};

// Git Tools
const gitTools = {
  gitLog: createTool({
    name: 'git_log',
    execute: async ({ filePath, limit, since }) => {
      // Get commit history
    }
  }),

  gitBlame: createTool({
    name: 'git_blame',
    execute: async ({ filePath, startLine, endLine }) => {
      // Get blame info
    }
  }),

  gitDiff: createTool({
    name: 'git_diff',
    execute: async ({ commitSha, filePath }) => {
      // Get diff
    }
  })
};

// Analysis Tools
const analysisTools = {
  parseAST: createTool({
    name: 'parse_ast',
    execute: async ({ filePath, language }) => {
      // Tree-sitter parsing
    }
  }),

  getDependencies: createTool({
    name: 'get_dependencies',
    execute: async ({ filePath }) => {
      // Extract imports/requires
    }
  }),

  getComplexityMetrics: createTool({
    name: 'get_complexity',
    execute: async ({ filePath }) => {
      // Cyclomatic complexity, etc.
    }
  })
};

// Memory Tools
const memoryTools = {
  searchSimilarPatterns: createTool({
    name: 'search_similar_patterns',
    execute: async ({ query, limit }) => {
      // Vector search in memory
    }
  }),

  getHistoricalTrend: createTool({
    name: 'get_trend',
    execute: async ({ fingerprint, timeRange }) => {
      // Get debt trend
    }
  }),

  checkPastFeedback: createTool({
    name: 'check_feedback',
    execute: async ({ pattern }) => {
      // Get team feedback on pattern
    }
  })
};
```

---

## Phase 5: Multi-Agent Systems

### 5.1 Agent Roster

```typescript
// libs/agents/src/roster.ts

interface AgentRoster {
  scanner: ScannerAgent;      // Finds surface-level issues
  architect: ArchitectAgent;  // Evaluates architecture
  historian: HistorianAgent;  // Analyzes git history
  critic: CriticAgent;        // Challenges findings
  planner: PlannerAgent;      // Creates remediation plans
}

// Agent configurations
const agentConfigs: Record<string, AgentConfig> = {
  scanner: {
    model: 'gpt-4o',
    maxTokens: 4000,
    tools: [...fileTools, ...analysisTools],
    systemPrompt: SCANNER_SYSTEM_PROMPT
  },

  architect: {
    model: 'claude-3-5-sonnet',
    maxTokens: 8000,
    tools: [...fileTools, ...gitTools, ...memoryTools],
    systemPrompt: ARCHITECT_SYSTEM_PROMPT
  },

  historian: {
    model: 'gpt-4o',
    maxTokens: 4000,
    tools: [...gitTools, ...memoryTools],
    systemPrompt: HISTORIAN_SYSTEM_PROMPT
  },

  critic: {
    model: 'claude-3-5-sonnet',
    maxTokens: 4000,
    tools: [...fileTools, ...memoryTools],
    systemPrompt: CRITIC_SYSTEM_PROMPT
  },

  planner: {
    model: 'claude-opus-4',
    maxTokens: 8000,
    tools: [...memoryTools],
    systemPrompt: PLANNER_SYSTEM_PROMPT
  }
};
```

### 5.2 Multi-Agent Orchestration

```typescript
// libs/agents/src/multi-agent/orchestrator.ts

interface MultiAgentOrchestrator {
  // Run a full multi-agent analysis
  async analyze(context: AnalysisContext): Promise<AnalysisResult>;
}

const multiAgentGraph = new StateGraph<MultiAgentState>({
  channels: {
    // Findings from each agent
    scannerFindings: { value: [] },
    architectFindings: { value: [] },
    historianContext: { value: {} },

    // Critic reviews
    criticReviews: { value: [] },

    // Final outputs
    validatedFindings: { value: [] },
    plan: { value: null }
  }
})
  // Phase 1: Parallel discovery
  .addNode('runDiscovery', async (state) => {
    const [scanner, architect, historian] = await Promise.all([
      runScannerAgent(state.context),
      runArchitectAgent(state.context),
      runHistorianAgent(state.context)
    ]);

    return {
      scannerFindings: scanner.findings,
      architectFindings: architect.findings,
      historianContext: historian.context
    };
  })

  // Phase 2: Critic reviews all findings
  .addNode('runCritic', async (state) => {
    const allFindings = [
      ...state.scannerFindings,
      ...state.architectFindings
    ];

    const reviews = await runCriticAgent({
      findings: allFindings,
      historicalContext: state.historianContext
    });

    return { criticReviews: reviews };
  })

  // Phase 3: Debate resolution
  .addNode('resolveDebates', async (state) => {
    const disputed = state.criticReviews.filter(r => r.disputed);

    // For disputed findings, run a debate
    const resolutions = await Promise.all(
      disputed.map(d => runDebate(d, state))
    );

    // Merge validated findings
    const validated = state.criticReviews
      .filter(r => !r.disputed || resolutions.find(res => res.id === r.id)?.accepted)
      .map(r => r.finding);

    return { validatedFindings: validated };
  })

  // Phase 4: Planning
  .addNode('createPlan', async (state) => {
    const plan = await runPlannerAgent({
      findings: state.validatedFindings,
      context: state.historianContext
    });

    return { plan };
  })

  .addEdge('__start__', 'runDiscovery')
  .addEdge('runDiscovery', 'runCritic')
  .addEdge('runCritic', 'resolveDebates')
  .addEdge('resolveDebates', 'createPlan')
  .addEdge('createPlan', '__end__');
```

### 5.3 Agent Communication Protocol

```typescript
// libs/agents/src/multi-agent/communication.ts

interface AgentMessage {
  id: string;
  from: AgentRole;
  to: AgentRole | 'broadcast';
  type: MessageType;
  content: MessageContent;
  timestamp: Date;
  inReplyTo?: string;
}

type MessageType =
  | 'finding'           // Report a finding
  | 'challenge'         // Challenge a finding
  | 'evidence'          // Provide supporting evidence
  | 'concede'           // Accept a challenge
  | 'escalate'          // Escalate to higher authority
  | 'consensus'         // Propose consensus
  | 'vote';             // Vote on proposal

interface Debate {
  id: string;
  topic: DebtItem;
  initiator: AgentRole;
  challenger: AgentRole;
  messages: AgentMessage[];
  status: 'active' | 'resolved' | 'escalated';
  resolution?: {
    accepted: boolean;
    reason: string;
    votes: Record<AgentRole, boolean>;
  };
}

// Debate resolution strategies
const resolutionStrategies = {
  // Majority vote
  majority: (votes: Record<AgentRole, boolean>) => {
    const yes = Object.values(votes).filter(v => v).length;
    return yes > Object.keys(votes).length / 2;
  },

  // Weighted by agent expertise
  weighted: (votes: Record<AgentRole, boolean>, topic: DebtItem) => {
    const weights = getAgentWeights(topic.debtType);
    let score = 0;
    for (const [agent, vote] of Object.entries(votes)) {
      score += vote ? weights[agent] : -weights[agent];
    }
    return score > 0;
  },

  // Conservative (any critic rejection = rejected)
  conservative: (votes: Record<AgentRole, boolean>) => {
    return !votes.critic || votes.critic;
  }
};
```

### 5.4 Conflict Resolution

```typescript
// libs/agents/src/multi-agent/conflict.ts

interface ConflictResolver {
  resolve(conflict: Conflict): Promise<Resolution>;
}

interface Conflict {
  type: 'contradictory_findings' | 'severity_disagreement' | 'classification_dispute';
  parties: AgentRole[];
  claims: Claim[];
  evidence: Evidence[];
}

class DebateBasedResolver implements ConflictResolver {
  async resolve(conflict: Conflict): Promise<Resolution> {
    // 1. Each party presents their case
    const cases = await Promise.all(
      conflict.parties.map(party =>
        this.presentCase(party, conflict)
      )
    );

    // 2. Cross-examination
    const rebuttals = await this.crossExamine(cases);

    // 3. Final arguments
    const finalArgs = await Promise.all(
      conflict.parties.map(party =>
        this.finalArgument(party, rebuttals)
      )
    );

    // 4. Neutral arbiter decides
    const decision = await this.arbiterDecision(
      conflict,
      cases,
      rebuttals,
      finalArgs
    );

    return decision;
  }

  private async arbiterDecision(
    conflict: Conflict,
    cases: Case[],
    rebuttals: Rebuttal[],
    finalArgs: FinalArgument[]
  ): Promise<Resolution> {
    // Use a separate LLM call with all context
    const prompt = buildArbiterPrompt(conflict, cases, rebuttals, finalArgs);

    const response = await this.llm.completeStructured(
      { messages: [{ role: 'user', content: prompt }] },
      ResolutionSchema
    );

    return response;
  }
}
```

---

## Implementation Order

### Phase 0 (Weeks 1-3)
1. Project scaffolding (NestJS, TypeORM, Docker)
2. Database schema + migrations
3. Repository module (CRUD, GitHub OAuth)
4. Webhook handling
5. Background job infrastructure (BullMQ)
6. Basic repo sync (clone, pull)

### Phase 1 (Week 4)
1. Embedding service setup
2. pgvector integration
3. File chunking logic
4. Basic similarity search API

### Phase 2 (Week 5)
1. LLM abstraction layer
2. OpenAI + Anthropic providers
3. Prompt template system
4. Structured output parsing
5. Token budgeting

### Phase 3 (Weeks 6-8)
1. LangGraph setup
2. Analyzer agent
3. Context agent
4. Reflection agent
5. Planning agent
6. Basic orchestrator

### Phase 4 (Weeks 9-10)
1. Episodic memory (scan history)
2. Semantic memory (patterns)
3. Temporal memory (trends)
4. RAG pipeline
5. Tool library expansion

### Phase 5 (Weeks 11-12)
1. Multi-agent orchestrator
2. Agent communication protocol
3. Debate system
4. Conflict resolution
5. End-to-end testing

---

## Key Files to Create

### Phase 0
- `apps/api/src/modules/repo/repo.entity.ts`
- `apps/api/src/modules/repo/repo.service.ts`
- `apps/api/src/modules/scan/scan.entity.ts`
- `apps/api/src/modules/debt/debt-item.entity.ts`
- `apps/api/src/modules/webhook/webhook.controller.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/jwt.strategy.ts`
- `apps/api/src/modules/auth/api-key.entity.ts`
- `libs/git/src/clone.service.ts`

### Phase 1-2
- `libs/embeddings/src/embedder.ts`
- `libs/embeddings/src/chunker.ts`
- `libs/llm/src/provider.interface.ts`
- `libs/llm/src/openai.provider.ts`
- `libs/llm/src/anthropic.provider.ts`
- `libs/llm/src/prompts/*.ts`

### Phase 3-5
- `libs/agents/src/analyzer/graph.ts`
- `libs/agents/src/context/graph.ts`
- `libs/agents/src/reflection/graph.ts`
- `libs/agents/src/planning/graph.ts`
- `libs/agents/src/orchestrator.ts`
- `libs/agents/src/multi-agent/orchestrator.ts`
- `libs/memory/src/episodic.ts`
- `libs/memory/src/semantic.ts`
- `libs/memory/src/temporal.ts`
