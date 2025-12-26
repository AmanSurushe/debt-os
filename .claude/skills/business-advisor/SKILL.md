---
name: business-advisor
description: Evaluates business implications of technical decisions. Analyzes ROI, competitive positioning, market value, and customer impact. Use when implementing features, making architectural decisions, evaluating feature proposals, pricing discussions, or analyzing costs vs. benefits of technical initiatives.
allowed-tools: Read, Grep, Glob
---

# Business Advisor

## Purpose

This skill ensures technical decisions align with DEBT-OS's business strategy and deliver measurable customer value. Claude should consider business implications when implementing features or making significant technical decisions.

## When to Activate

Claude should consider this perspective when:
- Implementing new features or capabilities
- Making architectural decisions with cost implications
- Evaluating trade-offs between technical approaches
- Discussing competitive differentiation
- Planning features that affect pricing or packaging

## Key Business Principles

### Value Drivers
DEBT-OS delivers value through four key drivers:
1. **Development Velocity** - 25-40% reduction in bug fix time, 30% faster feature delivery
2. **Developer Productivity** - 40% reduction in onboarding time, 60% less code archaeology
3. **Risk Mitigation** - 70% reduction in security debt, early circular dependency detection
4. **Strategic Planning** - Quantified debt inventory, accurate sprint planning

### ROI Framework
When evaluating features, consider:
- Developer time saved (hours × hourly cost × team size × 52 weeks)
- Bug premium reduction (extra debug time due to debt)
- Onboarding cost impact (months to productivity × salary × new hires)
- Velocity tax (% slowdown from debt × feature value)

### Competitive Positioning

| vs. SonarQube | vs. CodeClimate | vs. Manual Reviews |
|---------------|-----------------|-------------------|
| AI understanding vs. pattern matching | Actionable insights vs. metrics dashboards | Consistent, scalable, learns |
| Remediation vs. detection only | Context vs. numbers | Augments reviewers |

### Key Differentiators
1. **Multi-Agent AI** - Multiple specialized agents that debate and validate
2. **Context-Aware** - Git history, team patterns, codebase evolution
3. **Actionable Output** - Every finding includes remediation with effort estimates
4. **Learning System** - Improves from team feedback
5. **Continuous Monitoring** - Tracks trends, not just point-in-time

## Questions to Ask

When implementing features:
- Does this deliver measurable business value?
- How does this affect our competitive positioning?
- What's the ROI justification for this technical investment?
- Which customer segment benefits most?

## Target Market

- Engineering teams of 20-500 developers
- Companies with 3+ years of codebase history
- Series A+ or established enterprise
- Organizations facing velocity slowdowns

## Reference

See [docs/business/VALUE_PROPOSITION.md](../../../docs/business/VALUE_PROPOSITION.md) for complete documentation.
