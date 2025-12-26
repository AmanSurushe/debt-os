# DEBT-OS Developer Guide

A comprehensive guide for developers working on DEBT-OS. Whether you're fixing a bug, adding a feature, or just exploring the codebase, this guide will help you get started.

## Table of Contents

- [Prerequisites & Setup](#prerequisites--setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Build Process](#build-process)
- [Testing](#testing)
- [Code Standards](#code-standards)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites & Setup

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 20+ | JavaScript runtime |
| npm | 10+ | Package manager |
| Docker | 24+ | Container runtime |
| Docker Compose | 2.0+ | Multi-container orchestration |
| Git | 2.0+ | Version control |

### Recommended Tools

- **VS Code** with extensions: ESLint, Prettier, TypeScript
- **Postman** or **Insomnia** for API testing
- **DBeaver** or **pgAdmin** for database inspection

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/debt-os/debt-os.git
cd debt-os

# 2. Install dependencies (uses npm workspaces)
npm install

# 3. Start infrastructure services
npm run docker:up

# 4. Wait for services to be healthy
docker ps  # Check both postgres and redis are "healthy"

# 5. Copy and configure environment
cp apps/api/.env.example apps/api/.env

# 6. Run database migrations
npm run db:migrate

# 7. Start development server
npm run dev
```

### Environment Variables

Edit `apps/api/.env` with your settings:

```env
# Server
PORT=3001
NODE_ENV=development

# Database (match docker-compose.yml)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=debt_os
DB_PASSWORD=debt_os_dev
DB_DATABASE=debt_os

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT (generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# LLM Providers (optional for local dev without AI features)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# GitHub OAuth (for authentication)
GITHUB_CLIENT_ID=your-github-oauth-app-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-secret
GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback
```

### Verifying Setup

1. **API Health**: Visit http://localhost:3001/api/health
2. **Swagger Docs**: Visit http://localhost:3001/docs
3. **Database**: Run `npm run db:migrate` (should show no pending migrations)

---

## Project Structure

### Overview

DEBT-OS is a **monorepo** using npm workspaces:

```
debt-os/
├── apps/
│   └── api/                    # Main NestJS backend application
├── libs/
│   ├── agents/                 # Multi-agent system (LangGraph)
│   ├── memory/                 # Memory systems (episodic, semantic, temporal)
│   ├── llm/                    # LLM abstraction layer
│   ├── embeddings/             # Vector embeddings
│   └── git/                    # Git operations
├── infra/                      # Docker & infrastructure
├── docs/                       # Documentation
└── package.json                # Root workspace configuration
```

### apps/api/ - The Main Application

```
apps/api/src/
├── main.ts                     # Application entry point
├── app.module.ts               # Root module, imports all features
├── config/
│   └── configuration.ts        # Environment configuration
├── common/
│   ├── decorators/             # Custom decorators (@CurrentUser)
│   └── guards/                 # Auth guards
├── database/
│   ├── database.module.ts      # TypeORM setup
│   ├── data-source.ts          # Migration configuration
│   └── migrations/             # Database migrations
├── modules/
│   ├── auth/                   # Authentication (OAuth, JWT, API keys)
│   ├── repo/                   # Repository management
│   ├── scan/                   # Scan orchestration
│   ├── debt/                   # Debt item tracking
│   ├── webhook/                # GitHub/GitLab webhooks
│   ├── health/                 # Health checks
│   ├── llm/                    # LLM provider integration
│   ├── embeddings/             # Embedding service
│   ├── git/                    # Git service
│   ├── agents/                 # Agent orchestration
│   └── memory/                 # Memory service
└── queue/
    ├── queue.module.ts         # BullMQ configuration
    └── processors/             # Background job processors
```

### libs/ - Shared Libraries

Each library is a separate npm package (`@debt-os/*`):

| Library | Purpose | Key Files |
|---------|---------|-----------|
| `@debt-os/agents` | Multi-agent AI system | `scanner.ts`, `architect.ts`, `critic.ts`, `orchestrator.ts` |
| `@debt-os/memory` | Memory systems | `episodic/`, `semantic/`, `temporal/`, `rag/` |
| `@debt-os/llm` | LLM abstraction | `providers/`, `prompts/`, `types.ts` |
| `@debt-os/embeddings` | Vector embeddings | `chunking.ts`, `embedder.ts` |
| `@debt-os/git` | Git operations | `git.service.ts`, `clone.ts`, `blame.ts` |

---

## Development Workflow

### Adding a New Feature

1. **Create a branch**
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Understand the scope** - Determine which modules/libraries are affected

3. **Implement changes** following the patterns in existing code

4. **Add tests** - Unit tests for services, integration tests for endpoints

5. **Update documentation** if the feature affects public APIs

6. **Submit PR** with a clear description

### Fixing Bugs

1. **Reproduce the issue** - Create a minimal test case

2. **Write a failing test** that exposes the bug

3. **Implement the fix**

4. **Verify all tests pass** including the new one

5. **Submit PR** referencing the issue number

### Modifying an Agent

Agents are in `libs/agents/src/`:

```typescript
// Example: Adding a new tool to Scanner Agent
// File: libs/agents/src/multi-agent/agents/scanner.ts

// 1. Define the tool
const myNewTool = tool(
  async ({ param1, param2 }) => {
    // Tool implementation
    return { result: 'data' };
  },
  {
    name: 'my_new_tool',
    description: 'What this tool does',
    schema: z.object({
      param1: z.string().describe('First parameter'),
      param2: z.number().describe('Second parameter'),
    }),
  }
);

// 2. Add to agent's tool list
const tools = [existingTool1, existingTool2, myNewTool];
```

### Adding a New Debt Type

1. **Update types** in `libs/agents/src/types.ts`:
   ```typescript
   export type DebtType =
     | 'code_smell'
     | 'my_new_debt_type'  // Add here
     // ...
   ```

2. **Update Zod schema** in the same file:
   ```typescript
   export const DebtFindingSchema = z.object({
     debtType: z.enum([
       'code_smell',
       'my_new_debt_type',  // Add here
       // ...
     ]),
   });
   ```

3. **Update agent prompts** to recognize the new type

4. **Update remediation logic** in `planning/graph.ts` if needed

---

## Build Process

### Development Mode

```bash
# Start with hot-reload
npm run dev

# Or start specific workspace
npm run dev -w @debt-os/api
```

### Production Build

```bash
# Build all packages
npm run build

# Build specific library
npm run build -w @debt-os/agents

# Build order matters due to dependencies:
# 1. libs/git
# 2. libs/llm
# 3. libs/embeddings
# 4. libs/memory
# 5. libs/agents
# 6. apps/api
```

### Other Commands

```bash
# Type checking (no emit)
npm run typecheck

# Linting
npm run lint
npm run lint:fix

# Format code
npm run format

# Clean build artifacts
npm run clean
```

### Database Migrations

```bash
# Run pending migrations
npm run db:migrate

# Generate migration from entity changes
npm run db:generate -- -n MigrationName

# Revert last migration
npm run db:revert
```

---

## Testing

### Running Tests

```bash
# All tests
npm test

# With coverage
npm run test:cov

# Watch mode
npm run test:watch

# E2E tests
npm run test:e2e

# Specific workspace
npm test -w @debt-os/agents
```

### Writing Unit Tests

```typescript
// Example: Testing a service
// File: src/modules/scan/scan.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ScanService } from './scan.service';
import { Scan } from './entities/scan.entity';

describe('ScanService', () => {
  let service: ScanService;
  let mockRepository: { save: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    mockRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScanService,
        {
          provide: getRepositoryToken(Scan),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ScanService>(ScanService);
  });

  describe('create', () => {
    it('should create a scan', async () => {
      const scanData = { repositoryId: 'uuid', branch: 'main' };
      mockRepository.save.mockResolvedValue({ id: 'scan-id', ...scanData });

      const result = await service.create(scanData);

      expect(result.id).toBeDefined();
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(scanData)
      );
    });
  });
});
```

### Testing Agents

```typescript
// Mock LLM responses for deterministic tests
const mockLLM = {
  invoke: jest.fn().mockResolvedValue({
    content: JSON.stringify({
      findings: [{ debtType: 'code_smell', severity: 'medium' }],
    }),
  }),
};
```

---

## Code Standards

### TypeScript Rules

1. **Explicit types** - Always specify return types
2. **Strict null checks** - Handle undefined/null explicitly
3. **No any** - Use proper types or `unknown`
4. **Interfaces over types** - For object shapes

### NestJS Patterns

1. **Dependency Injection** - Use constructor injection
2. **DTOs** - Validate all input with class-validator
3. **Guards** - Protect routes with auth guards
4. **Pipes** - Transform and validate data

### Git Commit Format

```
<type>(<scope>): <description>

Examples:
feat(scanner): add complexity detection
fix(auth): resolve token refresh issue
docs(api): update endpoint documentation
refactor(memory): simplify storage interface
```

---

## Common Tasks

### Adding a New API Endpoint

1. **Create DTO** in `dto/` folder:
   ```typescript
   // dto/create-item.dto.ts
   export class CreateItemDto {
     @IsString()
     @MinLength(1)
     name: string;
   }
   ```

2. **Add method to service**:
   ```typescript
   async create(dto: CreateItemDto): Promise<Item> {
     const item = this.repository.create(dto);
     return this.repository.save(item);
   }
   ```

3. **Add endpoint to controller**:
   ```typescript
   @Post()
   @ApiOperation({ summary: 'Create item' })
   async create(@Body() dto: CreateItemDto) {
     return this.service.create(dto);
   }
   ```

### Adding a Database Migration

```bash
# Auto-generate from entity changes
npm run db:generate -- -n AddNewColumn

# Or create manual migration
touch apps/api/src/database/migrations/$(date +%s)000-MyMigration.ts
```

```typescript
// Manual migration example
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNewColumn1234567890000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE items ADD COLUMN new_field VARCHAR(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE items DROP COLUMN new_field
    `);
  }
}
```

### Adding a Background Job

1. **Define job data type**:
   ```typescript
   interface MyJobData {
     itemId: string;
     options: { force: boolean };
   }
   ```

2. **Add to queue**:
   ```typescript
   @InjectQueue('my-queue')
   private myQueue: Queue<MyJobData>;

   async enqueue(data: MyJobData) {
     await this.myQueue.add('my-job', data, { priority: 1 });
   }
   ```

3. **Create processor**:
   ```typescript
   @Processor('my-queue')
   export class MyProcessor extends WorkerHost {
     async process(job: Job<MyJobData>) {
       const { itemId, options } = job.data;
       // Process the job
     }
   }
   ```

---

## Troubleshooting

### Common Issues

#### Docker Services Won't Start

```bash
# Check logs
npm run docker:logs

# Restart services
npm run docker:down
npm run docker:up
```

#### Database Connection Failed

1. Check Docker is running: `docker ps`
2. Verify `.env` matches `docker-compose.yml`
3. Check port 5432 isn't in use

#### LLM Rate Limits

- Use smaller batch sizes
- Add delays between requests
- Check API key quota

#### Build Out of Memory

```bash
# Increase Node memory
NODE_OPTIONS="--max-old-space-size=8192" npm run build
```

### Debug Mode

```typescript
// Enable verbose logging
// In .env:
LOG_LEVEL=debug

// Or in code:
console.log(JSON.stringify(data, null, 2));
```

### Inspecting Queue Jobs

```bash
# Connect to Redis CLI
docker exec -it debt-os-redis redis-cli

# List pending jobs
LRANGE bull:scan:wait 0 -1
```

---

## Related Documentation

- [Architecture Guide](ARCHITECTURE.md) - System design and components
- [Contributing Guide](../../CONTRIBUTING.md) - Contribution process
- [Technical Spec](../TECHNICAL_SPEC.md) - Detailed specifications
- [API Reference](http://localhost:3001/docs) - Swagger documentation
