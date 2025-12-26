import { v4 as uuidv4 } from 'uuid';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DebtFinding } from '../../types';
import {
  Conflict,
  ConflictType,
  Claim,
  Evidence,
  Resolution,
  AgentRole,
} from '../types';

/**
 * Detects conflicts between findings from different agents
 */
export function detectConflicts(
  scannerFindings: DebtFinding[],
  architectFindings: DebtFinding[],
): Conflict[] {
  const conflicts: Conflict[] = [];

  // Check for contradictory findings (same file, different conclusions)
  for (const sf of scannerFindings) {
    for (const af of architectFindings) {
      if (sf.filePath !== af.filePath) continue;

      // Same file, overlapping lines
      if (hasOverlappingLines(sf, af)) {
        // Contradictory: one says issue exists, classifications differ significantly
        if (sf.debtType !== af.debtType && areMutuallyExclusive(sf.debtType, af.debtType)) {
          conflicts.push({
            id: uuidv4(),
            type: 'classification_dispute',
            parties: ['scanner', 'architect'],
            claims: [
              { agent: 'scanner', finding: sf, rationale: sf.description, confidence: sf.confidence },
              { agent: 'architect', finding: af, rationale: af.description, confidence: af.confidence },
            ],
            evidence: [],
            createdAt: new Date(),
          });
        }

        // Severity disagreement on same/similar issue
        if (sf.debtType === af.debtType && sf.severity !== af.severity) {
          const severityDiff = getSeverityDifference(sf.severity, af.severity);
          if (severityDiff >= 2) { // Significant disagreement
            conflicts.push({
              id: uuidv4(),
              type: 'severity_disagreement',
              parties: ['scanner', 'architect'],
              claims: [
                { agent: 'scanner', finding: sf, rationale: `Rated as ${sf.severity}`, confidence: sf.confidence },
                { agent: 'architect', finding: af, rationale: `Rated as ${af.severity}`, confidence: af.confidence },
              ],
              evidence: [],
              createdAt: new Date(),
            });
          }
        }
      }
    }
  }

  // Check for scope disagreement (same issue, different scope)
  const groupedByType = groupFindingsByType([...scannerFindings, ...architectFindings]);
  for (const [, findings] of groupedByType) {
    if (findings.length < 2) continue;

    const scopes = findings.map((f) => ({
      finding: f,
      scope: calculateScope(f),
    }));

    // If scopes differ significantly, it's a scope disagreement
    const maxScope = Math.max(...scopes.map((s) => s.scope));
    const minScope = Math.min(...scopes.map((s) => s.scope));

    if (maxScope > minScope * 2) {
      const larger = scopes.find((s) => s.scope === maxScope);
      const smaller = scopes.find((s) => s.scope === minScope);

      if (larger && smaller) {
        conflicts.push({
          id: uuidv4(),
          type: 'scope_disagreement',
          parties: ['scanner', 'architect'],
          claims: [
            { agent: 'scanner', finding: larger.finding, rationale: 'Broader scope identified', confidence: larger.finding.confidence },
            { agent: 'architect', finding: smaller.finding, rationale: 'Narrower scope identified', confidence: smaller.finding.confidence },
          ],
          evidence: [],
          createdAt: new Date(),
        });
      }
    }
  }

  return conflicts;
}

/**
 * Resolve a conflict using the specified strategy
 */
export async function resolveConflict(
  conflict: Conflict,
  llm: ChatOpenAI | ChatAnthropic,
): Promise<Resolution> {
  // Build prompt for LLM arbiter
  const prompt = buildConflictPrompt(conflict);

  const response = await llm.invoke([
    new SystemMessage(`You are a senior software architect resolving a disagreement between AI code analysis agents.

Your role:
1. Analyze both claims objectively
2. Consider the evidence provided
3. Make a fair decision
4. Merge findings if appropriate

Output your decision in JSON format:
{
  "decision": "accept_first" | "accept_second" | "merge" | "reject_both",
  "reasoning": "string explaining your decision",
  "mergedFinding": {optional merged finding object if decision is "merge"}
}`),
    new HumanMessage(prompt),
  ]);

  try {
    const content = response.content as string;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const decision = JSON.parse(jsonMatch[0]);

      let resultingFinding: DebtFinding | undefined;

      if (decision.decision === 'accept_first') {
        resultingFinding = conflict.claims[0].finding;
      } else if (decision.decision === 'accept_second') {
        resultingFinding = conflict.claims[1].finding;
      } else if (decision.decision === 'merge' && decision.mergedFinding) {
        resultingFinding = {
          ...conflict.claims[0].finding,
          ...decision.mergedFinding,
          id: uuidv4(),
        };
      }

      return {
        conflictId: conflict.id,
        decision: decision.decision,
        reasoning: decision.reasoning,
        resultingFinding,
        resolvedBy: 'arbiter',
      };
    }
  } catch {
    // Parsing failed
  }

  // Default: use evidence-based resolution
  return resolveByEvidence(conflict);
}

/**
 * Resolve conflict based on evidence weight
 */
function resolveByEvidence(conflict: Conflict): Resolution {
  // Calculate evidence weight for each party
  const weights: Record<AgentRole, number> = {
    scanner: 0,
    architect: 0,
    historian: 0,
    critic: 0,
    planner: 0,
  };

  for (const evidence of conflict.evidence) {
    weights[evidence.agent] += evidence.weight;
  }

  // Add confidence as implicit evidence
  for (const claim of conflict.claims) {
    weights[claim.agent] += claim.confidence;
  }

  // Find winner
  let winner: AgentRole = conflict.parties[0];
  let maxWeight = 0;

  for (const party of conflict.parties) {
    if (weights[party] > maxWeight) {
      maxWeight = weights[party];
      winner = party;
    }
  }

  const winningClaim = conflict.claims.find((c) => c.agent === winner);
  const decision = conflict.parties[0] === winner ? 'accept_first' : 'accept_second';

  return {
    conflictId: conflict.id,
    decision,
    reasoning: `Resolved by evidence weight. ${winner} had stronger evidence (weight: ${maxWeight.toFixed(2)})`,
    resultingFinding: winningClaim?.finding,
    resolvedBy: 'evidence',
  };
}

/**
 * Merge two overlapping findings
 */
export function mergeFindings(f1: DebtFinding, f2: DebtFinding): DebtFinding {
  // Take higher confidence
  const primary = f1.confidence >= f2.confidence ? f1 : f2;
  const secondary = f1.confidence >= f2.confidence ? f2 : f1;

  // Merge evidence
  const allEvidence = [...new Set([...primary.evidence, ...secondary.evidence])];

  // Take higher severity
  const primarySeverityNum = getSeverityNumber(primary.severity);
  const secondarySeverityNum = getSeverityNumber(secondary.severity);
  const severity = primarySeverityNum >= secondarySeverityNum ? primary.severity : secondary.severity;

  // Combine descriptions
  const description = primary.description.includes(secondary.description.slice(0, 50))
    ? primary.description
    : `${primary.description}\n\nAdditional context: ${secondary.description}`;

  return {
    id: uuidv4(),
    debtType: primary.debtType,
    severity,
    confidence: (primary.confidence + secondary.confidence) / 2,
    title: primary.title,
    description,
    filePath: primary.filePath,
    startLine: Math.min(primary.startLine || Infinity, secondary.startLine || Infinity),
    endLine: Math.max(primary.endLine || 0, secondary.endLine || 0),
    evidence: allEvidence,
    suggestedFix: primary.suggestedFix || secondary.suggestedFix,
  };
}

// Helper functions

function hasOverlappingLines(f1: DebtFinding, f2: DebtFinding): boolean {
  if (!f1.startLine || !f2.startLine) return true; // Assume overlap if no line info
  if (!f1.endLine || !f2.endLine) return true;

  return !(f1.endLine < f2.startLine || f2.endLine < f1.startLine);
}

function areMutuallyExclusive(type1: string, type2: string): boolean {
  const exclusivePairs = [
    ['dead_code', 'missing_tests'], // Can't test dead code
    ['god_class', 'feature_envy'], // Opposite problems
  ];

  for (const [a, b] of exclusivePairs) {
    if ((type1 === a && type2 === b) || (type1 === b && type2 === a)) {
      return true;
    }
  }

  return false;
}

function getSeverityNumber(severity: string): number {
  const severities: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
    info: 0,
  };
  return severities[severity] || 0;
}

function getSeverityDifference(s1: string, s2: string): number {
  return Math.abs(getSeverityNumber(s1) - getSeverityNumber(s2));
}

function groupFindingsByType(findings: DebtFinding[]): Map<string, DebtFinding[]> {
  const groups = new Map<string, DebtFinding[]>();

  for (const finding of findings) {
    const key = `${finding.filePath}:${finding.debtType}`;
    const existing = groups.get(key) || [];
    existing.push(finding);
    groups.set(key, existing);
  }

  return groups;
}

function calculateScope(finding: DebtFinding): number {
  if (finding.startLine && finding.endLine) {
    return finding.endLine - finding.startLine + 1;
  }
  return 1;
}

function buildConflictPrompt(conflict: Conflict): string {
  const lines: string[] = [
    `# Conflict: ${conflict.type}`,
    '',
    '## Claims',
    '',
  ];

  for (const claim of conflict.claims) {
    lines.push(`### ${claim.agent.toUpperCase()}`);
    lines.push(`- Type: ${claim.finding.debtType}`);
    lines.push(`- Severity: ${claim.finding.severity}`);
    lines.push(`- Title: ${claim.finding.title}`);
    lines.push(`- Confidence: ${claim.finding.confidence}`);
    lines.push(`- Rationale: ${claim.rationale}`);
    lines.push('');
  }

  if (conflict.evidence.length > 0) {
    lines.push('## Evidence');
    for (const e of conflict.evidence) {
      lines.push(`- [${e.agent}] ${e.type}: ${e.content} (weight: ${e.weight})`);
    }
    lines.push('');
  }

  lines.push('## Your Decision');
  lines.push('Analyze the claims and decide: accept_first, accept_second, merge, or reject_both');

  return lines.join('\n');
}

/**
 * Create a conflict resolution pipeline
 */
export class ConflictResolver {
  private llm: ChatOpenAI | ChatAnthropic;

  constructor(llm: ChatOpenAI | ChatAnthropic) {
    this.llm = llm;
  }

  /**
   * Resolve all conflicts
   */
  async resolveAll(conflicts: Conflict[]): Promise<Resolution[]> {
    const resolutions: Resolution[] = [];

    for (const conflict of conflicts) {
      const resolution = await resolveConflict(conflict, this.llm);
      resolutions.push(resolution);
    }

    return resolutions;
  }

  /**
   * Apply resolutions to findings
   */
  applyResolutions(
    findings: DebtFinding[],
    resolutions: Resolution[],
  ): DebtFinding[] {
    const result: DebtFinding[] = [];
    const resolvedFindingIds = new Set<string>();

    // Add findings from resolutions
    for (const resolution of resolutions) {
      if (resolution.resultingFinding) {
        result.push(resolution.resultingFinding);
      }

      // Mark original findings as resolved
      const conflict = resolutions.find((r) => r.conflictId === resolution.conflictId);
      // Note: in practice, we'd need to track the original finding IDs
    }

    // Add unresolved findings
    for (const finding of findings) {
      if (!resolvedFindingIds.has(finding.id)) {
        result.push(finding);
      }
    }

    return result;
  }
}
