# DEBT-OS Architecture

This document describes the system architecture of DEBT-OS, an AI-powered platform for technical debt detection and remediation.

## Table of Contents

- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Core Components](#core-components)
- [Multi-Agent System](#multi-agent-system)
- [Memory System](#memory-system)
- [Data Model](#data-model)
- [Background Processing](#background-processing)
- [Security Architecture](#security-architecture)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              DEBT-OS                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │   GitHub     │────▶│   Webhooks   │────▶│    Background Jobs       │ │
│  │   GitLab     │     │   Module     │     │    (BullMQ + Redis)      │ │
│  └──────────────┘     └──────────────┘     └───────────┬──────────────┘ │
│                                                         │                │
│  ┌──────────────┐     ┌──────────────┐                 ▼                │
│  │   REST API   │◀───▶│   NestJS     │     ┌──────────────────────────┐ │
│  │   Clients    │     │   Backend    │◀───▶│    Multi-Agent System    │ │
│  └──────────────┘     └──────┬───────┘     │  ┌────────┐ ┌────────┐   │ │
│                              │             │  │Scanner │ │Architect│  │ │
│                              ▼             │  └────────┘ └────────┘   │ │
│                       ┌──────────────┐     │  ┌────────┐ ┌────────┐   │ │
│                       │  PostgreSQL  │     │  │ Critic │ │Planner │   │ │
│                       │  + pgvector  │     │  └────────┘ └────────┘   │ │
│                       └──────────────┘     └──────────────────────────┘ │
│                                                         │                │
│                                                         ▼                │
│                                            ┌──────────────────────────┐ │
│                                            │      LLM Providers       │ │
│                                            │   OpenAI  │  Anthropic   │ │
│                                            └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Runtime** | Node.js 20+ | JavaScript runtime |
| **Language** | TypeScript 5.5+ | Type-safe development |
| **Backend** | NestJS | Modular, testable framework |
| **Database** | PostgreSQL 16 | Primary data store |
| **Vector Store** | pgvector | Semantic similarity search |
| **Queue** | BullMQ | Background job processing |
| **Cache** | Redis 7 | Queue backend & caching |
| **LLMs** | OpenAI, Anthropic | AI-powered analysis |
| **Agents** | LangGraph | Agent orchestration |
| **Validation** | Zod, class-validator | Schema & input validation |
| **Auth** | Passport.js | OAuth & JWT authentication |
| **ORM** | TypeORM | Database access layer |
| **API Docs** | Swagger/OpenAPI | API documentation |

---

## Core Components

### Monorepo Structure

```
debt-os/
├── apps/
│   └── api/                 # NestJS backend (main application)
│       ├── src/
│       │   ├── modules/     # Feature modules
│       │   ├── queue/       # Background processors
│       │   └── database/    # Migrations & config
│       └── test/            # E2E tests
└── libs/
    ├── agents/              # @debt-os/agents - Multi-agent AI system
    ├── memory/              # @debt-os/memory - Memory & RAG
    ├── llm/                 # @debt-os/llm - LLM abstraction
    ├── embeddings/          # @debt-os/embeddings - Vector embeddings
    └── git/                 # @debt-os/git - Git operations
```

### API Module Architecture

```
AppModule
├── ConfigModule (global)           # Environment configuration
├── DatabaseModule                  # TypeORM + PostgreSQL
├── QueueModule                     # BullMQ + Redis
├── AuthModule                      # OAuth, JWT, API Keys
├── RepoModule                      # Repository management
├── ScanModule                      # Scan orchestration
├── DebtModule                      # Debt item CRUD
├── WebhookModule                   # GitHub/GitLab webhooks
├── HealthModule                    # Health checks
├── LLMModule (global)              # LLM provider access
├── EmbeddingsModule                # Embedding generation
├── GitModule                       # Git operations
├── AgentsModule                    # Agent orchestration
└── MemoryModule                    # Memory system access
```

### Request Flow

```
HTTP Request
     │
     ▼
┌────────────┐    ┌────────────┐    ┌────────────┐
│  Guards    │───▶│ Controller │───▶│  Service   │
│(Auth, etc.)│    │(Validation)│    │(Business)  │
└────────────┘    └────────────┘    └────────────┘
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  ▼                       ▼                       ▼
            ┌──────────┐           ┌──────────┐           ┌──────────┐
            │Repository│           │  Queue   │           │ External │
            │(TypeORM) │           │ (BullMQ) │           │ Services │
            └──────────┘           └──────────┘           └──────────┘
```

---

## Multi-Agent System

### Agent Roster

DEBT-OS uses specialized AI agents that collaborate to analyze code:

| Agent | Role | LLM | Temperature |
|-------|------|-----|-------------|
| **Scanner** | Surface-level issue detection | GPT-4o | 0.3 |
| **Architect** | Architectural pattern analysis | Claude 3.5 | 0.2 |
| **Historian** | Git history & evolution analysis | GPT-4o-mini | 0.2 |
| **Critic** | Validates findings, filters false positives | Claude 3.5 | 0.1 |
| **Planner** | Creates remediation tasks | Claude 3.5 | 0.3 |

### Orchestration Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ORCHESTRATION PIPELINE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Phase 1: DISCOVERY (Parallel)                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │   Scanner   │  │  Architect  │  │  Historian  │                  │
│  │   Agent     │  │   Agent     │  │   Agent     │                  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
│         │                │                │                          │
│         └────────────────┼────────────────┘                          │
│                          ▼                                           │
│  Phase 2: DEBATE                                                     │
│  ┌─────────────────────────────────────────────┐                    │
│  │              Critic Agent                    │                    │
│  │  - Reviews each finding                      │                    │
│  │  - Challenges low-confidence items           │                    │
│  │  - Initiates debates                         │                    │
│  └──────────────────────┬──────────────────────┘                    │
│                          ▼                                           │
│  Phase 3: RESOLUTION                                                 │
│  ┌─────────────────────────────────────────────┐                    │
│  │           Debate Resolution                  │                    │
│  │  - Multi-round discussions                   │                    │
│  │  - Voting strategies (majority, weighted)    │                    │
│  │  - Arbiter LLM for complex disputes          │                    │
│  └──────────────────────┬──────────────────────┘                    │
│                          ▼                                           │
│  Phase 4: PLANNING                                                   │
│  ┌─────────────────────────────────────────────┐                    │
│  │             Planner Agent                    │                    │
│  │  - Groups findings into tasks                │                    │
│  │  - Estimates effort                          │                    │
│  │  - Identifies quick wins                     │                    │
│  └─────────────────────────────────────────────┘                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Agent Communication

Agents communicate via a message bus:

```typescript
// Message Types
type MessageType =
  | 'finding'      // Agent reports a debt finding
  | 'challenge'    // Critic challenges a finding
  | 'defend'       // Agent defends their finding
  | 'concede'      // Agent concedes the challenge
  | 'vote'         // Agent votes on resolution
  | 'consensus'    // Agreement reached
  | 'escalate';    // Escalate to arbiter

// Message Structure
interface AgentMessage {
  id: string;
  from: AgentRole;
  to: AgentRole | 'all';
  type: MessageType;
  threadId: string;
  content: MessageContent;
  timestamp: Date;
}
```

### Conflict Resolution

When agents disagree:

1. **Detection**: Conflicting findings on same code location
2. **Classification**: Type dispute, severity dispute, or scope dispute
3. **Resolution Strategies**:
   - **Majority**: Most agents agree
   - **Weighted**: Expertise-based voting
   - **Conservative**: Critic has veto power
   - **Arbiter**: LLM makes final decision

---

## Memory System

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MEMORY SYSTEM                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │
│  │    EPISODIC     │  │    SEMANTIC     │  │    TEMPORAL     │      │
│  │     MEMORY      │  │     MEMORY      │  │     MEMORY      │      │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤      │
│  │ What happened   │  │ What we know    │  │ How things      │      │
│  │ - Past scans    │  │ - Patterns      │  │   change        │      │
│  │ - Findings      │  │ - Rules         │  │ - Trends        │      │
│  │ - Feedback      │  │ - Best practices│  │ - Velocity      │      │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘      │
│           │                    │                    │                │
│           └────────────────────┼────────────────────┘                │
│                                ▼                                     │
│                    ┌─────────────────────┐                          │
│                    │    RAG Pipeline     │                          │
│                    │ Context retrieval   │                          │
│                    │ for agent prompts   │                          │
│                    └─────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Episodic Memory

Stores historical events:
- **Scan Results**: Complete history of past scans
- **Findings**: Individual debt items with fingerprints
- **Feedback**: User confirmations/rejections
- **File History**: Issues per file over time

### Semantic Memory

Stores knowledge and patterns:
- **Detection Patterns**: Reusable patterns with embeddings
- **Architecture Rules**: Dependency, naming, structure rules
- **Precision Stats**: Track pattern accuracy

### Temporal Memory

Tracks changes over time:
- **Debt Trends**: New, recurring, improving, worsening
- **Velocity**: Rate of debt creation vs. resolution
- **Hotspots**: High-churn, high-risk files

---

## Data Model

### Core Entities

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│     User     │────▶│  Repository  │────▶│     Scan     │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                     ┌────────────────────────────┼────────────────────────────┐
                     ▼                            ▼                            ▼
              ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
              │ FileSnapshot │            │  DebtFinding │            │Remediation   │
              └──────────────┘            └──────────────┘            │    Plan      │
                     │                                                └──────────────┘
                     ▼                                                       │
              ┌──────────────┐                                               ▼
              │FileEmbedding │                                        ┌──────────────┐
              └──────────────┘                                        │Remediation   │
                                                                      │    Task      │
                                                                      └──────────────┘
```

### Entity Details

| Entity | Key Fields | Purpose |
|--------|------------|---------|
| **User** | email, provider, accessToken | OAuth users |
| **Repository** | fullName, provider, settings | Connected repos |
| **Scan** | status, progress, stats | Analysis runs |
| **FileSnapshot** | path, hash, language, embedding | File state per scan |
| **FileEmbedding** | chunkIndex, embedding, tokens | Vector chunks |
| **DebtFinding** | type, severity, confidence, evidence | Detected issues |
| **RemediationPlan** | summary, quickWins, strategic | Action plans |
| **RemediationTask** | title, effort, priority, dependencies | Individual tasks |
| **CommitInfo** | sha, message, author, embedding | Git history |

---

## Background Processing

### Queue Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BULLMQ QUEUES                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐            │
│  │  repo-sync  │     │    scan     │     │  embedding  │            │
│  │   Queue     │────▶│   Queue     │────▶│   Queue     │            │
│  └─────────────┘     └─────────────┘     └─────────────┘            │
│        │                   │                   │                     │
│        ▼                   ▼                   ▼                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐            │
│  │ RepoSync    │     │    Scan     │     │  Embedding  │            │
│  │ Processor   │     │  Processor  │     │  Processor  │            │
│  └─────────────┘     └─────────────┘     └─────────────┘            │
│                                                                      │
│  Job Configuration:                                                  │
│  - Retries: 3 with exponential backoff                              │
│  - Keep completed: 100 jobs                                         │
│  - Keep failed: 1000 jobs                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Job Types

| Queue | Job | Purpose |
|-------|-----|---------|
| `repo-sync` | clone | Clone repository locally |
| `repo-sync` | pull | Update existing clone |
| `scan` | analyze | Run multi-agent analysis |
| `embedding` | generate | Create vector embeddings |

---

## Security Architecture

### Authentication Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATION METHODS                           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. GitHub OAuth                                                      │
│     User ──▶ GitHub ──▶ Callback ──▶ JWT Token                       │
│                                                                       │
│  2. JWT Bearer Token                                                  │
│     Request + Header: Authorization: Bearer <token>                   │
│                                                                       │
│  3. API Key (for CLI/automation)                                     │
│     Request + Header: X-API-Key: <key>                               │
│     Scopes: read, write, admin                                        │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Security Measures

| Layer | Measure |
|-------|---------|
| **Transport** | HTTPS only in production |
| **Authentication** | JWT with expiration, API key hashing |
| **Authorization** | Role-based access, resource ownership |
| **Input** | Validation pipes, DTO whitelisting |
| **Database** | Parameterized queries (TypeORM) |
| **Secrets** | Environment variables, encrypted tokens |
| **API Keys** | Bcrypt hashing, scope restrictions |

### Data Protection

- **Repository Access Tokens**: Encrypted at rest
- **API Keys**: Hashed with bcrypt (prefix visible)
- **Sensitive Config**: Environment variables only
- **Audit Trail**: Action logging for compliance

---

## Performance Considerations

### Batching Strategies

- **File Analysis**: Process in batches of 5 files
- **Embeddings**: Batch API calls (max 100 per request)
- **Database**: Bulk inserts for findings

### Token Budget Management

```typescript
// Per-scan token limits
const TOKEN_BUDGET = {
  scanner: 50000,
  architect: 30000,
  critic: 20000,
  planner: 15000,
};
```

### Caching

- **Redis**: Queue data, session tokens
- **In-Memory**: Pattern cache, config
- **Database**: Indexed queries, materialized views

---

## Related Documentation

- [Developer Guide](DEVELOPER_GUIDE.md) - Hands-on development
- [Operations Guide](../operations/OPERATIONS_GUIDE.md) - Deployment & monitoring
- [Technical Spec](../TECHNICAL_SPEC.md) - Detailed specifications
