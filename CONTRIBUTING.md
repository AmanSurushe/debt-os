# Contributing to DEBT-OS

Thank you for your interest in contributing to DEBT-OS! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Monorepo Guidelines](#monorepo-guidelines)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Getting Help](#getting-help)

## Getting Started

### Prerequisites

- **Node.js 20+** - JavaScript runtime
- **Docker & Docker Compose** - For PostgreSQL and Redis
- **Git** - Version control
- **VS Code** (recommended) - With ESLint and Prettier extensions

### Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/debt-os.git
cd debt-os
git remote add upstream https://github.com/debt-os/debt-os.git
```

### Initial Setup

```bash
# Install dependencies
npm install

# Start infrastructure
npm run docker:up

# Copy environment file
cp apps/api/.env.example apps/api/.env

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### Verify Setup

1. API should be running at http://localhost:3001/api
2. Swagger docs at http://localhost:3001/docs
3. Run `npm test` to ensure tests pass

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

| Prefix | Use Case | Example |
|--------|----------|---------|
| `feature/` | New features | `feature/add-gitlab-support` |
| `fix/` | Bug fixes | `fix/scan-timeout-error` |
| `docs/` | Documentation | `docs/update-api-guide` |
| `refactor/` | Code refactoring | `refactor/agent-state-management` |
| `test/` | Test additions | `test/add-scanner-tests` |

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code refactoring
- `test` - Adding tests
- `chore` - Maintenance tasks

**Examples:**
```bash
feat(agents): add historian agent for git analysis
fix(scan): resolve timeout issue for large repositories
docs(api): update authentication endpoints documentation
refactor(memory): simplify episodic memory interface
```

### Keeping Your Fork Updated

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## Code Standards

### TypeScript Conventions

```typescript
// Use explicit return types
function calculateScore(findings: DebtFinding[]): number {
  return findings.reduce((sum, f) => sum + f.confidence, 0);
}

// Use interfaces over types for objects
interface ScanConfig {
  repositoryId: string;
  branch: string;
  depth?: number;
}

// Use enums for fixed sets
enum DebtSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

// Prefer const assertions
const SUPPORTED_LANGUAGES = ['typescript', 'javascript', 'python'] as const;
```

### NestJS Patterns

```typescript
// Use dependency injection
@Injectable()
export class ScanService {
  constructor(
    @InjectRepository(Scan)
    private scanRepository: Repository<Scan>,
    private gitService: GitService,
  ) {}
}

// Use DTOs with validation
export class CreateScanDto {
  @IsUUID()
  repositoryId: string;

  @IsOptional()
  @IsString()
  branch?: string;
}

// Use guards for authentication
@Controller('scans')
@UseGuards(AuthGuard('jwt'))
export class ScanController {
  // ...
}
```

### File Organization

```
src/modules/feature/
├── feature.module.ts       # Module definition
├── feature.controller.ts   # HTTP endpoints
├── feature.service.ts      # Business logic
├── dto/                    # Data transfer objects
│   ├── create-feature.dto.ts
│   └── update-feature.dto.ts
├── entities/               # TypeORM entities
│   └── feature.entity.ts
└── feature.service.spec.ts # Unit tests
```

### Linting and Formatting

```bash
# Run linting
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Format code (if Prettier is configured)
npm run format
```

## Monorepo Guidelines

### Workspace Structure

```
debt-os/
├── apps/
│   └── api/           # NestJS application
└── libs/
    ├── agents/        # Multi-agent system
    ├── memory/        # Memory systems
    ├── llm/           # LLM abstraction
    ├── embeddings/    # Vector embeddings
    └── git/           # Git operations
```

### Working with Libraries

```bash
# Build a specific library
npm run build -w @debt-os/agents

# Run tests for a library
npm test -w @debt-os/llm

# Add a dependency to a library
npm install some-package -w @debt-os/memory
```

### Creating a New Library

1. Create the directory structure:
```bash
mkdir -p libs/new-lib/src
```

2. Create `package.json`:
```json
{
  "name": "@debt-os/new-lib",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  }
}
```

3. Create `tsconfig.json` and source files
4. Add to root workspace in `package.json`

### Cross-Package Dependencies

- Libraries should depend on other `@debt-os/*` packages via `peerDependencies`
- The API app imports libraries directly
- Avoid circular dependencies between libraries

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch

# Run e2e tests
npm run test:e2e
```

### Writing Tests

```typescript
// Unit test example
describe('ScanService', () => {
  let service: ScanService;
  let repository: MockRepository<Scan>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ScanService,
        { provide: getRepositoryToken(Scan), useClass: MockRepository },
      ],
    }).compile();

    service = module.get<ScanService>(ScanService);
    repository = module.get(getRepositoryToken(Scan));
  });

  it('should create a scan', async () => {
    const dto = { repositoryId: 'uuid', branch: 'main' };
    repository.save.mockResolvedValue({ id: 'scan-id', ...dto });

    const result = await service.create(dto);

    expect(result.id).toBeDefined();
    expect(repository.save).toHaveBeenCalled();
  });
});
```

### Test Coverage Requirements

- Aim for 80% coverage on new code
- Critical paths (auth, scan processing) should have comprehensive tests
- Mock external services (LLM APIs, Git operations)

## Pull Request Process

### Before Submitting

1. **Update from main**: Ensure your branch is up to date
2. **Run tests**: `npm test` must pass
3. **Run linting**: `npm run lint` must pass
4. **Build**: `npm run build` must succeed
5. **Update docs**: If you changed APIs or added features

### PR Checklist

```markdown
## Description
[Describe what this PR does]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass locally
- [ ] I have updated relevant documentation
- [ ] My changes generate no new warnings
```

### Review Process

1. Submit PR against `main` branch
2. Automated checks run (tests, linting)
3. Request review from maintainers
4. Address feedback and update PR
5. Maintainer approves and merges

### After Merge

- Delete your feature branch
- Pull latest main to your fork
- Celebrate your contribution!

## Getting Help

### Resources

- **Documentation**: Check the [docs/](docs/) folder
- **Technical Spec**: See [docs/TECHNICAL_SPEC.md](docs/TECHNICAL_SPEC.md)
- **API Reference**: http://localhost:3001/docs (when running locally)

### Communication

- **Issues**: Report bugs or request features via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Report security issues privately to security@debt-os.dev

### Issue Templates

When reporting bugs, include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Node version)
- Relevant logs

When requesting features, include:
- Use case description
- Proposed solution (if any)
- Alternatives considered

---

Thank you for contributing to DEBT-OS! Your efforts help make technical debt management better for everyone.
