---
name: sales-advisor
description: Provides sales perspective on implementation decisions. Evaluates sellability, demo-ability, customer pain points, objection handling, and competitive differentiation. Use when building customer-facing features, APIs, planning demos, or considering how features will be positioned and sold.
allowed-tools: Read, Grep, Glob
---

# Sales Advisor

## Purpose

This skill ensures features are sellable and align with customer needs. Claude should consider sales implications when implementing customer-facing capabilities.

## When to Activate

Claude should consider this perspective when:
- Building customer-facing features
- Implementing APIs that customers will use
- Creating demo-worthy functionality
- Addressing customer pain points
- Planning feature announcements

## Key Sales Principles

### Elevator Pitches

**30-Second**: "DEBT-OS is an AI platform that automatically finds and prioritizes technical debt. Unlike traditional tools that just count issues, our multi-agent AI understands your code, explains why problems exist, and creates actionable remediation plans."

**Value Hook**: "Engineering teams using DEBT-OS see 40% faster development velocity within 6 months."

### Target Buyer Personas

| Persona | Key Motivations | Key Messages |
|---------|-----------------|--------------|
| CTO/VP Engineering | Strategic visibility, board reporting, risk mitigation | "Quantify technical debt for budget discussions" |
| Engineering Manager | Team velocity, sprint planning, developer satisfaction | "Know what to prioritize in each sprint" |
| Tech Lead | Code quality, reduced review burden, architecture | "AI that catches what code reviews miss" |

### Customer Pain Points

1. **"We don't know where our debt is"** → Complete codebase scan, categorized inventory
2. **"We can't prioritize what to fix"** → AI-driven severity scoring, effort estimates
3. **"Code reviews miss architectural issues"** → Architect agent, cross-file analysis
4. **"New developers take too long to onboard"** → Contextual explanations, git history

### Competitive Differentiation

**vs. SonarQube**: "SonarQube tells you WHAT is wrong. DEBT-OS tells you WHY and HOW to fix it."

**vs. CodeClimate**: "CodeClimate shows numbers. DEBT-OS shows what to do about them."

**vs. Manual Reviews**: "DEBT-OS doesn't replace reviewers—it gives them superpowers."

### Common Objections

| Objection | Response |
|-----------|----------|
| "We already use SonarQube" | DEBT-OS complements it with AI analysis and remediation planning |
| "AI findings will be noisy" | Critic agent filters to <10% false positive rate |
| "No budget" | 4 hrs/week on debt × team = $400K+ in recovered productivity |

## Demo Flow

Key demo moments to enable:
1. Connect repository (GitHub OAuth)
2. Show multi-agent analysis progress
3. Review findings with evidence and git context
4. Demonstrate prioritization and effort estimates
5. Show remediation plan generation

## Questions to Ask

When implementing features:
- Can I demo this effectively?
- Does this address a known customer pain point?
- How would we position this against competitors?
- What objections might customers raise?

## Reference

See [docs/sales/SALES_PLAYBOOK.md](../../../docs/sales/SALES_PLAYBOOK.md) for complete documentation.
