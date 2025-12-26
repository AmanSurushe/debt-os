import { v4 as uuidv4 } from 'uuid';
import {
  SemanticMemory,
  DebtPattern,
  ArchitectureRule,
  AnalysisContext,
  PatternValidationStats,
  MemoryStorage,
} from '../types';

export interface SemanticMemoryConfig {
  storage: MemoryStorage;
  defaultSimilarityThreshold?: number;
}

export class SemanticMemoryImpl implements SemanticMemory {
  private storage: MemoryStorage;
  private defaultThreshold: number;

  constructor(config: SemanticMemoryConfig) {
    this.storage = config.storage;
    this.defaultThreshold = config.defaultSimilarityThreshold || 0.75;
  }

  /**
   * Store a new debt pattern
   */
  async storePattern(pattern: DebtPattern): Promise<void> {
    const patternWithDefaults: DebtPattern = {
      ...pattern,
      id: pattern.id || uuidv4(),
      validationStats: pattern.validationStats || {
        totalMatches: 0,
        confirmedValid: 0,
        confirmedFalsePositive: 0,
        precision: 1.0,
      },
      createdAt: pattern.createdAt || new Date(),
      updatedAt: new Date(),
    };

    // Store the pattern document
    await this.storage.store('patterns', patternWithDefaults);

    // Store the embedding for vector search
    if (pattern.embedding && pattern.embedding.length > 0) {
      await this.storage.storeVector('pattern_embeddings', patternWithDefaults.id, pattern.embedding);
    }
  }

  /**
   * Find patterns similar to a given embedding
   */
  async findSimilarPatterns(embedding: number[], threshold?: number): Promise<DebtPattern[]> {
    const effectiveThreshold = threshold || this.defaultThreshold;

    // Search for similar vectors
    const vectorResults = await this.storage.searchVectors(
      'pattern_embeddings',
      embedding,
      20,
      effectiveThreshold,
    );

    // Fetch full pattern documents
    const patterns: DebtPattern[] = [];
    for (const result of vectorResults) {
      const pattern = await this.storage.get<DebtPattern>('patterns', result.id);
      if (pattern) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Store an architecture rule
   */
  async storeRule(rule: ArchitectureRule): Promise<void> {
    const ruleWithDefaults: ArchitectureRule = {
      ...rule,
      id: rule.id || uuidv4(),
      enabled: rule.enabled ?? true,
      createdAt: rule.createdAt || new Date(),
    };

    await this.storage.store('rules', ruleWithDefaults);
  }

  /**
   * Get rules applicable to a given context
   */
  async getRulesFor(context: AnalysisContext): Promise<ArchitectureRule[]> {
    // Get all rules for the repository
    const repoRules = await this.storage.query<ArchitectureRule>('rules', {
      field: 'repositoryId',
      operator: 'eq',
      value: context.repositoryId,
    });

    // Filter by enabled status and context matching
    return repoRules.filter((rule) => {
      if (!rule.enabled) return false;

      // Check if rule scope matches context
      if (context.filePath && rule.condition.scope) {
        const scopeRegex = new RegExp(rule.condition.scope);
        if (!scopeRegex.test(context.filePath)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get all stored patterns
   */
  async getAllPatterns(): Promise<DebtPattern[]> {
    // Query all patterns (using a filter that matches everything)
    return this.storage.query<DebtPattern>('patterns', {
      field: 'id',
      operator: 'neq',
      value: '', // Get all non-empty IDs
    });
  }

  /**
   * Update pattern validation statistics
   */
  async updatePatternStats(patternId: string, wasValid: boolean): Promise<void> {
    const pattern = await this.storage.get<DebtPattern>('patterns', patternId);
    if (!pattern) return;

    const stats = pattern.validationStats;
    const newStats: PatternValidationStats = {
      totalMatches: stats.totalMatches + 1,
      confirmedValid: stats.confirmedValid + (wasValid ? 1 : 0),
      confirmedFalsePositive: stats.confirmedFalsePositive + (wasValid ? 0 : 1),
      precision: 0,
    };

    // Calculate new precision
    if (newStats.totalMatches > 0) {
      newStats.precision = newStats.confirmedValid / newStats.totalMatches;
    }

    await this.storage.update('patterns', patternId, {
      validationStats: newStats,
      updatedAt: new Date(),
    });
  }

  /**
   * Get patterns by debt type
   */
  async getPatternsByType(debtType: string): Promise<DebtPattern[]> {
    return this.storage.query<DebtPattern>('patterns', {
      field: 'debtType',
      operator: 'eq',
      value: debtType,
    });
  }

  /**
   * Get high-precision patterns for analysis
   */
  async getHighPrecisionPatterns(minPrecision: number = 0.8): Promise<DebtPattern[]> {
    const allPatterns = await this.getAllPatterns();

    return allPatterns.filter((p) => {
      // Require at least 5 validations for reliable precision
      if (p.validationStats.totalMatches < 5) return false;
      return p.validationStats.precision >= minPrecision;
    });
  }

  /**
   * Search patterns by name/description
   */
  async searchPatterns(query: string): Promise<DebtPattern[]> {
    const allPatterns = await this.getAllPatterns();
    const lowerQuery = query.toLowerCase();

    return allPatterns.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.description.toLowerCase().includes(lowerQuery),
    );
  }

  /**
   * Update a rule
   */
  async updateRule(ruleId: string, updates: Partial<ArchitectureRule>): Promise<void> {
    await this.storage.update('rules', ruleId, updates);
  }

  /**
   * Delete a rule
   */
  async deleteRule(ruleId: string): Promise<void> {
    await this.storage.delete('rules', ruleId);
  }

  /**
   * Toggle rule enabled status
   */
  async toggleRule(ruleId: string): Promise<boolean> {
    const rule = await this.storage.get<ArchitectureRule>('rules', ruleId);
    if (!rule) throw new Error(`Rule ${ruleId} not found`);

    const newEnabled = !rule.enabled;
    await this.storage.update('rules', ruleId, { enabled: newEnabled });
    return newEnabled;
  }
}

export function createSemanticMemory(config: SemanticMemoryConfig): SemanticMemory {
  return new SemanticMemoryImpl(config);
}

// Default patterns for common debt types
export const DEFAULT_DEBT_PATTERNS: Omit<DebtPattern, 'id' | 'embedding' | 'validationStats' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'God Class',
    description: 'A class that has grown too large and handles too many responsibilities',
    debtType: 'god_class',
    codePattern: 'class with >500 lines or >20 methods or >10 dependencies',
    examples: [
      {
        code: 'class UserManager { /* 50+ methods handling auth, profile, settings, notifications... */ }',
        language: 'typescript',
        isPositive: true,
      },
    ],
  },
  {
    name: 'Long Function',
    description: 'A function that is too long and does too many things',
    debtType: 'complexity',
    codePattern: 'function with >50 lines or >5 levels of nesting',
    examples: [
      {
        code: 'function processOrder() { /* 100+ lines with nested conditionals */ }',
        language: 'typescript',
        isPositive: true,
      },
    ],
  },
  {
    name: 'Hardcoded Secrets',
    description: 'Credentials or API keys hardcoded in source code',
    debtType: 'security_issue',
    codePattern: 'string containing api_key, password, secret, token with literal values',
    examples: [
      {
        code: 'const API_KEY = "sk-1234567890abcdef";',
        language: 'typescript',
        isPositive: true,
      },
    ],
  },
  {
    name: 'Missing Error Handling',
    description: 'Async operations without proper error handling',
    debtType: 'code_smell',
    codePattern: 'await without try-catch or .catch()',
    examples: [
      {
        code: 'const data = await fetch(url); // no error handling',
        language: 'typescript',
        isPositive: true,
      },
    ],
  },
  {
    name: 'Circular Dependency',
    description: 'Modules that depend on each other creating a cycle',
    debtType: 'circular_dependency',
    codePattern: 'import A from B; // in file A, and import B from A; // in file B',
    examples: [
      {
        code: '// fileA.ts: import { B } from "./fileB";\n// fileB.ts: import { A } from "./fileA";',
        language: 'typescript',
        isPositive: true,
      },
    ],
  },
];
