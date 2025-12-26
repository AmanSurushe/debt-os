---
name: technical-advisor
description: Provides technical architecture perspective. Evaluates code quality, architectural alignment, development standards, and technical best practices. Use when implementing features, refactoring code, making design decisions, or ensuring consistency with existing patterns.
allowed-tools: Read, Grep, Glob
---

# Technical Advisor

## Purpose

This skill ensures implementations follow DEBT-OS's technical standards and architectural patterns. Claude should consider technical implications when writing or modifying code.

## When to Activate

Claude should consider this perspective when:
- Implementing new features
- Refactoring existing code
- Making architectural decisions
- Adding new dependencies
- Creating new modules or services

## Key Technical Principles

### Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+, TypeScript 5.5+ |
| Backend | NestJS 10.4 |
| Database | PostgreSQL 16 + pgvector |
| ORM | TypeORM 0.3 |
| Queue | BullMQ + Redis 7 |
| LLM | OpenAI, Anthropic via LangGraph |
| Validation | Zod, class-validator |
| Auth | Passport.js (OAuth, JWT, API Keys) |

### Monorepo Structure

```
apps/api/           # NestJS backend (main application)
├── src/modules/    # Feature modules
├── src/queue/      # Background processors
└── src/database/   # Migrations & config

libs/
├── agents/         # @debt-os/agents - Multi-agent AI system
├── memory/         # @debt-os/memory - Memory & RAG
├── llm/            # @debt-os/llm - LLM abstraction
├── embeddings/     # @debt-os/embeddings - Vector embeddings
└── git/            # @debt-os/git - Git operations
```

### Multi-Agent Architecture

**Agent Roster**:
| Agent | Role | LLM | Temperature |
|-------|------|-----|-------------|
| Scanner | Surface-level issue detection | GPT-4o | 0.3 |
| Architect | Architectural pattern analysis | Claude 3.5 Sonnet | 0.2 |
| Historian | Git history analysis | GPT-4o | 0.2 |
| Critic | Validates findings, filters false positives | Claude 3.5 Sonnet | 0.1 |
| Planner | Creates remediation tasks | Claude 3.5 Sonnet | 0.3 |

**Orchestration Pipeline**:
1. Discovery (parallel) → Scanner, Architect, Historian
2. Debate → Critic challenges findings
3. Resolution → Voting/arbiter resolution
4. Planning → Create remediation tasks

### Memory System

Three-layer architecture:
1. **Episodic** - Past scans, findings, feedback
2. **Semantic** - Debt patterns with embeddings (pgvector)
3. **Temporal** - Trends, velocity, hotspots over time

### NestJS Module Pattern

```
AppModule
├── ConfigModule (global)
├── DatabaseModule
├── QueueModule
├── AuthModule
├── RepoModule
├── ScanModule
├── DebtModule
└── ...
```

### Code Standards

- TypeScript strict mode
- Explicit return types
- Interfaces for objects, enums for fixed sets
- NestJS dependency injection patterns
- Standardized file structure (module → controller → service → repository)

### Key Files

| Pattern | Reference File |
|---------|---------------|
| Type definitions | libs/agents/src/multi-agent/types.ts |
| Agent config | libs/agents/src/multi-agent/roster.ts |
| Agent implementation | libs/agents/src/multi-agent/agents/scanner.ts |
| Debate system | libs/agents/src/multi-agent/debate/index.ts |
| Orchestrator | libs/agents/src/multi-agent/orchestrator.ts |
| LLM client | libs/llm/src/llm-client.ts |
| Memory types | libs/memory/src/types.ts |

### Common Commands

```bash
npm run dev              # Start API with watch mode
npm run build            # Build API
npm test                 # Run all tests
npm run lint             # ESLint check
npm run db:migrate       # Run migrations
```

## Questions to Ask

When implementing features:
- Does this follow the existing architectural patterns?
- Which library or module should this code live in?
- Are we following NestJS conventions?
- Have we considered the multi-agent integration?
- Is this consistent with the existing codebase?

## Reference

See [docs/technical/ARCHITECTURE.md](../../../docs/technical/ARCHITECTURE.md) and [docs/technical/DEVELOPER_GUIDE.md](../../../docs/technical/DEVELOPER_GUIDE.md) for complete documentation.
