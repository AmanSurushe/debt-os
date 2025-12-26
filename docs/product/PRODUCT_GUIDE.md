# DEBT-OS Product Guide

A comprehensive guide to DEBT-OS features, capabilities, and roadmap.

## Table of Contents

- [Product Vision](#product-vision)
- [Target Users](#target-users)
- [Current Features](#current-features)
- [Roadmap](#roadmap)
- [User Stories](#user-stories)
- [API Reference](#api-reference)
- [Configuration Options](#configuration-options)

---

## Product Vision

### Mission Statement

> Empower engineering teams to understand, prioritize, and systematically eliminate technical debt through intelligent automation.

### Long-Term Vision

DEBT-OS will become the **technical health platform** for modern software teams, providing:
- Continuous visibility into codebase health
- AI-powered recommendations for improvement
- Automated remediation for common issues
- Integration with development workflows

### Core Principles

1. **Actionable over Informational** - Every finding includes next steps
2. **Context over Metrics** - Understanding why, not just what
3. **Collaborative over Individual** - Team-oriented workflows
4. **Adaptive over Static** - Learns and improves from feedback

---

## Target Users

### Primary Personas

#### Engineering Manager

**Profile**: Manages 5-15 engineers, responsible for delivery and quality

**Goals**:
- Understand team velocity blockers
- Justify technical work to stakeholders
- Plan sprint capacity for debt reduction
- Track improvement over time

**Key Features Used**:
- Dashboard & reports
- Trend tracking
- Prioritized backlog
- Effort estimates

#### Tech Lead / Senior Developer

**Profile**: Technical decision-maker, mentors junior developers

**Goals**:
- Identify architectural issues early
- Guide team on best practices
- Reduce code review burden
- Maintain code quality standards

**Key Features Used**:
- Architectural analysis
- Pattern detection
- Code context & explanations
- Integration with IDE

#### Platform Engineer

**Profile**: Maintains developer tooling and infrastructure

**Goals**:
- Automate code quality checks
- Integrate with CI/CD pipelines
- Manage scanning at scale
- Configure organizational rules

**Key Features Used**:
- API & webhooks
- Custom rules
- Batch processing
- Admin dashboard

### Secondary Personas

#### Security Engineer
- Focuses on security-related debt (vulnerabilities, secrets)
- Uses severity filters and compliance reports

#### New Developer
- Uses contextual explanations to understand legacy code
- Benefits from remediation guides

---

## Current Features

### v0.1.0 - Foundation Release

#### Repository Management

| Feature | Description |
|---------|-------------|
| **GitHub Integration** | Connect repositories via OAuth |
| **GitLab Integration** | Connect repositories via OAuth |
| **Repository Settings** | Configure scan parameters per repo |
| **Webhook Support** | Auto-scan on push events |
| **Batch Connection** | Import multiple repos at once |

#### Debt Detection

| Debt Type | Description | Severity Range |
|-----------|-------------|----------------|
| `code_smell` | Poor code patterns | Low - Medium |
| `complexity` | High cyclomatic complexity | Medium - High |
| `duplication` | Repeated code blocks | Low - Medium |
| `dead_code` | Unused functions/variables | Low |
| `circular_dependency` | Module dependency cycles | High - Critical |
| `layer_violation` | Architectural boundary breaks | Medium - High |
| `god_class` | Classes with too many responsibilities | Medium - High |
| `feature_envy` | Methods that use other classes excessively | Medium |
| `hardcoded_config` | Magic numbers, hardcoded strings | Low - Medium |
| `security_issue` | Potential vulnerabilities | High - Critical |
| `missing_tests` | Code without test coverage | Medium |
| `missing_docs` | Public APIs without documentation | Low |
| `outdated_dependency` | Old package versions | Medium - High |
| `vulnerable_dependency` | Packages with known CVEs | Critical |

#### Analysis Capabilities

| Feature | Description |
|---------|-------------|
| **Multi-Agent Analysis** | Scanner, Architect, Critic agents |
| **File-Level Scanning** | Analyze individual files |
| **Cross-File Analysis** | Detect patterns across codebase |
| **Git History Context** | Understand when/why debt was introduced |
| **Confidence Scoring** | 0-100% confidence per finding |
| **Evidence Collection** | Code snippets proving the issue |

#### Remediation Planning

| Feature | Description |
|---------|-------------|
| **Task Generation** | Automatic remediation tasks |
| **Effort Estimation** | Trivial/Small/Medium/Large/XLarge |
| **Priority Scoring** | 1-10 based on severity and impact |
| **Quick Wins** | Low-effort, high-impact items |
| **Dependency Mapping** | Which fixes depend on others |

#### API & Integrations

| Endpoint Category | Key Endpoints |
|-------------------|---------------|
| **Authentication** | OAuth, JWT, API Keys |
| **Repositories** | CRUD, sync, settings |
| **Scans** | Trigger, status, results |
| **Debt Items** | List, filter, update |
| **Webhooks** | GitHub, GitLab events |

---

## Roadmap

### Phase 1: Foundation (Current)
*Core detection and planning capabilities*

- [x] Multi-agent detection system
- [x] GitHub/GitLab integration
- [x] Remediation planning
- [x] REST API
- [ ] Basic dashboard

### Phase 2: Intelligence
*Enhanced AI capabilities*

- [ ] Full multi-agent debate system
- [ ] Memory system integration
- [ ] Learning from user feedback
- [ ] Pattern library expansion
- [ ] Custom rule definition

### Phase 3: Automation
*Reduce manual intervention*

- [ ] Auto-fix suggestions
- [ ] Pull request generation
- [ ] CI/CD pipeline integration
- [ ] IDE plugins (VS Code, JetBrains)
- [ ] Slack/Teams notifications

### Phase 4: Enterprise
*Scale and governance*

- [ ] Team management
- [ ] Role-based access control
- [ ] SSO integration (SAML, OIDC)
- [ ] Audit logging
- [ ] Custom branding
- [ ] On-premise deployment

### Phase 5: Platform
*Ecosystem expansion*

- [ ] Plugin marketplace
- [ ] Custom agent development
- [ ] Third-party integrations
- [ ] API rate limiting tiers
- [ ] Usage analytics

---

## User Stories

### Repository Management

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| RM-1 | As a user, I want to connect my GitHub repository so that DEBT-OS can analyze it | OAuth flow completes, repo appears in list, initial sync starts |
| RM-2 | As a user, I want to configure scan settings per repository | Can set branch, file filters, scan frequency |
| RM-3 | As a user, I want to receive automatic scans on push | Webhook configured, scan triggers on push to main |

### Debt Detection

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| DD-1 | As a developer, I want to see all technical debt in my codebase | Scan completes, findings displayed by severity |
| DD-2 | As a tech lead, I want to understand why debt exists | Finding includes git context, blame info |
| DD-3 | As a team, I want false positives filtered out | Critic agent reviews, low-confidence items flagged |

### Remediation

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| RE-1 | As a manager, I want prioritized remediation tasks | Tasks sorted by priority with effort estimates |
| RE-2 | As a developer, I want to know how to fix each issue | Detailed remediation steps provided |
| RE-3 | As a team, I want to identify quick wins | Separate list of low-effort, high-impact items |

### Tracking

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| TR-1 | As a manager, I want to track debt trends over time | Charts showing debt count by severity over scans |
| TR-2 | As an engineer, I want to mark items as resolved | Status update, removal from active list |
| TR-3 | As leadership, I want periodic reports | Automated weekly/monthly summaries |

### Integration

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| IN-1 | As a platform engineer, I want API access | Full REST API with authentication |
| IN-2 | As a developer, I want CLI access | API keys work from command line |
| IN-3 | As DevOps, I want CI/CD integration | Can fail builds based on debt thresholds |

---

## API Reference

### Authentication

```bash
# OAuth (browser-based)
GET /api/auth/github
GET /api/auth/gitlab

# JWT Token
POST /api/auth/token
Authorization: Bearer <jwt_token>

# API Key
X-API-Key: <api_key>
```

### Repositories

```bash
# Connect repository
POST /api/repos
{
  "provider": "github",
  "fullName": "owner/repo"
}

# List repositories
GET /api/repos

# Trigger sync
POST /api/repos/:id/sync

# Update settings
PATCH /api/repos/:id/settings
```

### Scans

```bash
# Trigger scan
POST /api/repos/:id/scans
{
  "branch": "main",
  "full": true
}

# Get scan status
GET /api/scans/:id

# Get scan results
GET /api/scans/:id/results
```

### Debt Items

```bash
# List debt items
GET /api/repos/:id/debt?severity=high&type=complexity

# Get debt details
GET /api/debt/:id

# Update status
PATCH /api/debt/:id
{
  "status": "in_progress"
}

# Provide feedback
POST /api/debt/:id/feedback
{
  "valid": false,
  "reason": "This is intentional"
}
```

### Webhooks

```bash
# GitHub webhook
POST /api/webhooks/github
X-Hub-Signature-256: sha256=...

# GitLab webhook
POST /api/webhooks/gitlab
X-Gitlab-Token: ...
```

Full API documentation available at `/docs` when running locally.

---

## Configuration Options

### Repository Settings

```json
{
  "scanSettings": {
    "branch": "main",
    "autoScan": true,
    "scanOnPush": true,
    "scanSchedule": "0 0 * * *"
  },
  "fileFilters": {
    "include": ["src/**/*.ts", "lib/**/*.ts"],
    "exclude": ["**/*.test.ts", "node_modules/**"]
  },
  "analysisSettings": {
    "enabledAgents": ["scanner", "architect", "critic"],
    "complexityThreshold": 10,
    "duplicationMinLines": 6
  },
  "notifications": {
    "onNewCritical": true,
    "weeklyReport": true,
    "email": "team@example.com"
  }
}
```

### Severity Thresholds

| Setting | Default | Description |
|---------|---------|-------------|
| `criticalThreshold` | 0 | Max critical items before alert |
| `highThreshold` | 10 | Max high items before alert |
| `failBuildOn` | `critical` | Fail CI on this severity+ |

### Agent Configuration

| Agent | Setting | Default |
|-------|---------|---------|
| Scanner | `batchSize` | 5 files |
| Scanner | `maxTokens` | 50,000 |
| Architect | `depthLimit` | 10 levels |
| Critic | `challengeThreshold` | 0.7 confidence |

---

## Related Documentation

- [Value Proposition](../business/VALUE_PROPOSITION.md) - Business value
- [Architecture](../technical/ARCHITECTURE.md) - Technical design
- [Developer Guide](../technical/DEVELOPER_GUIDE.md) - Development workflow
- [Operations Guide](../operations/OPERATIONS_GUIDE.md) - Deployment
