---
name: management-advisor
description: Provides engineering management perspective. Evaluates resource requirements, KPI impact, risk assessment, timeline feasibility, and reporting needs. Use when planning features, estimating effort, assessing project risks, or defining success metrics.
allowed-tools: Read, Grep, Glob
---

# Management Advisor

## Purpose

This skill ensures technical decisions are feasible from a resource, risk, and governance perspective. Claude should consider management implications when planning features or making decisions with resource impact.

## When to Activate

Claude should consider this perspective when:
- Planning new features or initiatives
- Estimating effort and timelines
- Assessing project risks
- Defining success metrics and KPIs
- Creating reports or dashboards

## Key Management Principles

### Strategic Goals

| Goal | Timeframe | Target |
|------|-----------|--------|
| Visibility | 30 days | Complete debt inventory across all codebases |
| Prioritization | 60 days | Data-driven prioritization of remediation |
| Velocity | 6 months | Measurable improvement in development velocity |
| Culture | 12 months | Continuous debt management practices |

### Key Performance Indicators

**Technical Debt Metrics**:
- Debt Item Count (target: decreasing weekly)
- Debt by Severity (target: critical < 5)
- Debt Resolution Rate (target: > 10/sprint)
- Mean Time to Remediation (target: < 30 days)

**System Performance**:
- Scan Completion Rate (target: > 99%)
- Average Scan Duration (target: < 30 min)
- Finding Accuracy (target: > 90%)
- API Availability (target: > 99.5%)

### Risk Assessment Framework

| Risk Type | Examples | Mitigation |
|-----------|----------|------------|
| Technical | LLM costs, false positives, performance | Token budgeting, Critic agent, caching |
| Operational | Team resistance, integration issues | Clear value communication, API-first |
| Business | Low ROI, scope creep | Clear metrics, defined roadmap |

### Decision Framework (Prioritization Matrix)

```
              HIGH IMPACT
                   │
    STRATEGIC      │    QUICK WINS
    (Plan for      │    (Do Now)
     next quarter) │
                   │
LOW EFFORT ────────┼──────── HIGH EFFORT
                   │
    MONITOR        │    DEFER
    (Track but     │    (Backlog)
     don't act)    │
                   │
              LOW IMPACT
```

### Severity Response

| Severity | Response Time | Action |
|----------|---------------|--------|
| Critical | Immediate | Create hotfix ticket, assign owner |
| High | Within sprint | Add to current sprint backlog |
| Medium | Next sprint | Prioritize for upcoming sprint |
| Low | Quarterly | Include in quarterly planning |

## Resource Planning

| Role | Time Commitment |
|------|-----------------|
| DEBT-OS Admin | 2-4 hrs/week |
| Engineering Manager | 2 hrs/week |
| Tech Lead | 4-6 hrs/week |
| DevOps | 2 hrs/week |

## Questions to Ask

When implementing features:
- What resources are required to implement and maintain this?
- How do we measure success?
- What are the risks and mitigations?
- What's the escalation path if issues arise?

## Reference

See [docs/management/MANAGEMENT_OVERVIEW.md](../../../docs/management/MANAGEMENT_OVERVIEW.md) for complete documentation.
