---
name: product-advisor
description: Provides product management perspective. Evaluates alignment with product vision, roadmap fit, user persona needs, and feature prioritization. Use when implementing new features, evaluating requirements, planning product changes, or considering user experience.
allowed-tools: Read, Grep, Glob
---

# Product Advisor

## Purpose

This skill ensures features align with DEBT-OS's product vision and serve user needs. Claude should consider product implications when implementing features or making decisions that affect user experience.

## When to Activate

Claude should consider this perspective when:
- Implementing new features
- Modifying existing functionality
- Planning API changes
- Evaluating user stories
- Prioritizing work

## Key Product Principles

### Product Vision

**Mission**: Empower engineering teams to understand, prioritize, and systematically eliminate technical debt through intelligent automation.

**Core Principles**:
1. **Actionable over Informational** - Every finding includes next steps
2. **Context over Metrics** - Understanding why, not just what
3. **Collaborative over Individual** - Team-oriented workflows
4. **Adaptive over Static** - Learns and improves from feedback

### Target Personas

**Engineering Manager** (Primary):
- Manages 5-15 engineers
- Goals: Understand velocity blockers, justify technical work, plan sprint capacity
- Uses: Dashboard, reports, trend tracking, effort estimates

**Tech Lead / Senior Developer**:
- Technical decision-maker, mentors juniors
- Goals: Identify architectural issues, guide best practices, reduce review burden
- Uses: Architectural analysis, pattern detection, code context

**Platform Engineer**:
- Maintains developer tooling and CI/CD
- Goals: Automate quality checks, integrate with pipelines, manage at scale
- Uses: API, webhooks, custom rules, batch processing

### Current Features (v0.1.0)

**Debt Detection Types**:
- code_smell, complexity, duplication, dead_code
- circular_dependency, layer_violation, god_class, feature_envy
- hardcoded_config, security_issue
- missing_tests, missing_docs
- outdated_dependency, vulnerable_dependency

**Analysis Capabilities**:
- Multi-agent analysis (Scanner, Architect, Critic)
- File-level and cross-file analysis
- Git history context
- Confidence scoring with evidence

**Remediation**:
- Automatic task generation
- Effort estimation (Trivial/Small/Medium/Large/XLarge)
- Priority scoring (1-10)
- Quick wins identification

### Product Roadmap

| Phase | Focus | Key Features |
|-------|-------|--------------|
| 1 (Current) | Foundation | Multi-agent detection, GitHub/GitLab, remediation planning |
| 2 | Intelligence | Full debate system, memory, learning from feedback |
| 3 | Automation | Auto-fix, PR generation, CI/CD integration, IDE plugins |
| 4 | Enterprise | Teams, RBAC, SSO, audit logging, on-premise |
| 5 | Platform | Plugin marketplace, custom agents, third-party integrations |

### User Stories Format

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| XX-N | As a [persona], I want [goal] so that [benefit] | Testable conditions |

Key stories to reference:
- RM-1: Connect GitHub repository
- DD-1: See all technical debt in codebase
- RE-1: Prioritized remediation tasks
- TR-1: Track debt trends over time

## Questions to Ask

When implementing features:
- Which persona benefits from this?
- Does this align with our product principles?
- Where does this fit in the roadmap?
- What's the user story and acceptance criteria?
- How does this affect existing user workflows?

## Reference

See [docs/product/PRODUCT_GUIDE.md](../../../docs/product/PRODUCT_GUIDE.md) for complete documentation.
