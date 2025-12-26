# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DEBT-OS is an AI-powered technical debt detection and remediation platform. It uses multiple AI agents (Scanner, Architect, Historian, Critic, Planner) that collaborate, debate, and validate findings to deliver accurate technical debt insights.

## Common Commands

```bash
# Development
npm run dev              # Start API with watch mode (port 3001)
npm run docker:up        # Start PostgreSQL + Redis containers
npm run docker:down      # Stop containers

# Build
npm run build            # Build API
npm run start:prod       # Run production build

# Testing
npm test                 # Run all tests
npm run test:cov         # With coverage
npm run test:e2e         # End-to-end tests
npm test -w @debt-os/llm # Test specific library

# Database
npm run db:migrate       # Run migrations
npm run db:generate      # Generate new migration

# Linting
npm run lint             # ESLint check
npm run lint --fix       # Auto-fix issues

# Library-specific
npm run build -w @debt-os/agents  # Build specific library
```

## Architecture

### Monorepo Structure

- **apps/api/** - NestJS backend application (entry: `src/main.ts`)
- **libs/** - Shared libraries as npm workspaces:
  - `@debt-os/agents` - Multi-agent system and orchestration
  - `@debt-os/memory` - Three-layer memory system (episodic, semantic, temporal)
  - `@debt-os/llm` - Unified LLM client for OpenAI/Anthropic
  - `@debt-os/embeddings` - Vector embedding generation
  - `@debt-os/git` - Git operations wrapper

### Multi-Agent System

Five specialized agents work through a pipeline:

1. **Phase 1 (DISCOVERY)** - Scanner, Architect, Historian run in parallel
2. **Phase 2 (DEBATE)** - Critic challenges low-confidence findings
3. **Phase 3 (RESOLUTION)** - Voting/discussion to resolve conflicts
4. **Phase 4 (PLANNING)** - Planner creates remediation tasks

Agent roster defined in `libs/agents/src/multi-agent/roster.ts`. Debate and resolution logic in `libs/agents/src/multi-agent/debate/` and `resolution/`.

### Memory System

Three-layer architecture in `libs/memory/`:
- **Episodic** - Past scans, findings, feedback
- **Semantic** - Debt patterns with embeddings (pgvector)
- **Temporal** - Trends, velocity, hotspots over time

RAG pipeline combines retrieved context with agent queries.

### Request Flow

1. HTTP request → NestJS Controller → Service → Repository → PostgreSQL
2. Long-running operations queued via BullMQ
3. Queue processors in `apps/api/src/queue/processors/`:
   - `scan.processor.ts` - Clones repos, orchestrates analysis
   - `embedding.processor.ts` - Generates vector embeddings
   - `repo-sync.processor.ts` - Syncs repository metadata

### LLM Integration

`@debt-os/llm` provides unified interface:
- OpenAI (GPT-4o, GPT-4o-mini) and Anthropic (Claude 3.5, Claude Opus 4)
- Token budget management in `libs/llm/src/budget.ts`
- Structured output via Zod schemas
- Model configs in `libs/llm/src/models.ts`

## Tech Stack

- **Runtime**: Node.js 20+, TypeScript 5.5+
- **Backend**: NestJS 10.4
- **Database**: PostgreSQL 16 + pgvector
- **Queue**: BullMQ + Redis 7
- **ORM**: TypeORM 0.3
- **LLM SDKs**: openai 4.70, @anthropic-ai/sdk 0.32
- **Agent Framework**: LangGraph 0.2, LangChain 0.3
- **Auth**: Passport.js (OAuth, JWT, API keys)

## Key Files

- `apps/api/src/config/configuration.ts` - Environment config
- `apps/api/src/database/data-source.ts` - TypeORM configuration
- `libs/agents/src/multi-agent/orchestrator.ts` - Multi-agent orchestration
- `libs/agents/src/types.ts` - Core agent type definitions
- `libs/memory/src/types.ts` - Memory system interfaces
- `libs/llm/src/llm-client.ts` - Unified LLM client

## Environment Setup

Required in `apps/api/.env`:
```
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=debt_os
DB_PASSWORD=debt_os_dev
DB_DATABASE=debt_os
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=<secret>
REPO_STORAGE_PATH=/tmp/debt-os/repos
```

## API Documentation

Swagger UI available at `http://localhost:3001/docs` when running in development.
