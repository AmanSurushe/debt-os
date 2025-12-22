# DEBT-OS

An agentic system that detects, explains, prioritizes, and plans technical debt remediation over time.

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose

### Setup

1. **Start infrastructure**
   ```bash
   npm run docker:up
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp apps/api/.env.example apps/api/.env
   # Edit .env with your settings
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Access the API**
   - API: http://localhost:3001/api
   - Swagger Docs: http://localhost:3001/docs

## Project Structure

```
debt-os/
├── apps/api/          # NestJS backend
├── libs/
│   ├── git/           # Git operations
│   ├── agents/        # LangGraph agents (Phase 3+)
│   ├── llm/           # LLM abstraction
│   ├── embeddings/    # Vector embeddings
│   └── memory/        # Memory systems
├── cli/               # CLI tool (future)
├── infra/             # Docker & infrastructure
└── docs/              # Documentation
```

## API Endpoints

### Authentication
- `GET /api/auth/github` - GitHub OAuth login
- `GET /api/auth/me` - Current user

### Repositories
- `POST /api/repos` - Connect a repository
- `GET /api/repos` - List repositories
- `POST /api/repos/:id/sync` - Trigger sync

### Scans
- `POST /api/repos/:id/scans` - Trigger scan
- `GET /api/scans/:id` - Get scan details

### Debt Items
- `GET /api/repos/:id/debt` - List debt items
- `GET /api/debt/:id` - Get debt details
- `PATCH /api/debt/:id` - Update status

### Webhooks
- `POST /api/webhooks/github` - GitHub webhook

## Development

```bash
# Start Docker services
npm run docker:up

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## License

MIT
