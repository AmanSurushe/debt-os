# DEBT-OS

**AI-Powered Technical Debt Detection and Remediation Platform**

DEBT-OS is an intelligent system that automatically detects, explains, prioritizes, and plans technical debt remediation across your codebases. Unlike traditional static analysis tools that only find surface-level issues, DEBT-OS uses multiple AI agents that collaborate, debate, and validate findings to deliver accurate, actionable insights.

Built for engineering teams who want to stop guessing about technical debt and start making data-driven decisions about code quality and architecture.

## Key Features

- **Multi-Agent Detection** - Scanner, Architect, and Critic agents work together to find code smells, architectural issues, circular dependencies, and security vulnerabilities
- **Intelligent Prioritization** - AI-driven severity scoring with effort estimates for each finding
- **Remediation Planning** - Automated generation of actionable remediation tasks with quick wins highlighted
- **Trend Tracking** - Monitor debt trends over time to measure improvement and identify hotspots
- **Memory System** - Learns from past scans and user feedback to improve accuracy
- **Git-Aware Context** - Understands code history to explain how debt accumulated

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- GitHub account (for OAuth)

### Setup

```bash
# 1. Clone and install
git clone https://github.com/your-org/debt-os.git
cd debt-os
npm install

# 2. Start infrastructure (PostgreSQL + Redis)
npm run docker:up

# 3. Configure environment
cp apps/api/.env.example apps/api/.env
# Edit .env with your API keys and settings

# 4. Run migrations and start
npm run db:migrate
npm run dev
```

**Access Points:**
- API: http://localhost:3001/api
- Swagger Docs: http://localhost:3001/docs

## Documentation

| Audience | Document | Description |
|----------|----------|-------------|
| **Everyone** | [Contributing Guide](CONTRIBUTING.md) | How to contribute to DEBT-OS |
| **Developers** | [Developer Guide](docs/technical/DEVELOPER_GUIDE.md) | Setup, workflow, coding standards |
| **Architects** | [Architecture](docs/technical/ARCHITECTURE.md) | System design and components |
| **Business** | [Value Proposition](docs/business/VALUE_PROPOSITION.md) | ROI and business case |
| **Product** | [Product Guide](docs/product/PRODUCT_GUIDE.md) | Features and roadmap |
| **Sales** | [Sales Playbook](docs/sales/SALES_PLAYBOOK.md) | Pitch and differentiation |
| **Operations** | [Operations Guide](docs/operations/OPERATIONS_GUIDE.md) | Deployment and maintenance |
| **Management** | [Management Overview](docs/management/MANAGEMENT_OVERVIEW.md) | KPIs and planning |
| **Marketing** | [Marketing Brief](docs/marketing/MARKETING_BRIEF.md) | Messaging and positioning |

## Project Structure

```
debt-os/
├── apps/api/              # NestJS backend application
├── libs/
│   ├── agents/            # Multi-agent system (Scanner, Architect, Critic)
│   ├── memory/            # Episodic, Semantic, Temporal memory
│   ├── llm/               # LLM abstraction (OpenAI, Anthropic)
│   ├── embeddings/        # Vector embeddings with pgvector
│   └── git/               # Git operations
├── infra/                 # Docker & infrastructure
└── docs/                  # Documentation
```

## API Overview

| Endpoint | Description |
|----------|-------------|
| `POST /api/repos` | Connect a repository |
| `POST /api/repos/:id/scans` | Trigger debt analysis |
| `GET /api/scans/:id` | Get scan results |
| `GET /api/repos/:id/debt` | List debt items |
| `POST /api/webhooks/github` | GitHub webhook integration |

See [Swagger Docs](http://localhost:3001/docs) for complete API reference.

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | NestJS (TypeScript) |
| Database | PostgreSQL 16 + pgvector |
| Queue | BullMQ + Redis |
| LLMs | OpenAI GPT-4o, Anthropic Claude |
| Agents | LangGraph |

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:
- Setting up your development environment
- Code standards and conventions
- Pull request process
- Testing requirements

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Built with AI agents that think like your best engineers.**
