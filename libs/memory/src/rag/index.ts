import {
  RAGContext,
  RetrievedChunk,
  HistoricalContext,
  DebtFinding,
  DebtPattern,
  UserFeedback,
  EpisodicMemory,
  SemanticMemory,
} from '../types';

export interface RAGPipelineConfig {
  episodicMemory: EpisodicMemory;
  semanticMemory: SemanticMemory;
  embeddingService: EmbeddingService;
  maxChunks?: number;
  maxPatterns?: number;
  maxHistoricalFindings?: number;
  similarityThreshold?: number;
}

export interface EmbeddingService {
  embedQuery(query: string): Promise<number[]>;
  searchSimilar(options: {
    query: string;
    repositoryId: string;
    limit?: number;
    threshold?: number;
  }): Promise<RetrievedChunk[]>;
}

export class RAGPipeline {
  private episodicMemory: EpisodicMemory;
  private semanticMemory: SemanticMemory;
  private embeddingService: EmbeddingService;
  private maxChunks: number;
  private maxPatterns: number;
  private maxHistoricalFindings: number;
  private similarityThreshold: number;

  constructor(config: RAGPipelineConfig) {
    this.episodicMemory = config.episodicMemory;
    this.semanticMemory = config.semanticMemory;
    this.embeddingService = config.embeddingService;
    this.maxChunks = config.maxChunks || 10;
    this.maxPatterns = config.maxPatterns || 5;
    this.maxHistoricalFindings = config.maxHistoricalFindings || 10;
    this.similarityThreshold = config.similarityThreshold || 0.7;
  }

  /**
   * Build full RAG context for a query
   */
  async buildContext(
    query: string,
    repositoryId: string,
    filePath?: string,
  ): Promise<RAGContext> {
    // Run all retrievals in parallel
    const [retrievedChunks, relevantPatterns, historicalContext] = await Promise.all([
      this.retrieveCodeChunks(query, repositoryId),
      this.retrievePatterns(query),
      this.retrieveHistoricalContext(repositoryId, filePath),
    ]);

    return {
      query,
      retrievedChunks,
      relevantPatterns,
      historicalContext,
    };
  }

  /**
   * Retrieve relevant code chunks using vector similarity
   */
  async retrieveCodeChunks(
    query: string,
    repositoryId: string,
  ): Promise<RetrievedChunk[]> {
    try {
      const chunks = await this.embeddingService.searchSimilar({
        query,
        repositoryId,
        limit: this.maxChunks,
        threshold: this.similarityThreshold,
      });

      return chunks;
    } catch {
      // Return empty if embedding service fails
      return [];
    }
  }

  /**
   * Retrieve relevant debt patterns
   */
  async retrievePatterns(query: string): Promise<DebtPattern[]> {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddingService.embedQuery(query);

      // Find similar patterns
      const patterns = await this.semanticMemory.findSimilarPatterns(
        queryEmbedding,
        this.similarityThreshold,
      );

      return patterns.slice(0, this.maxPatterns);
    } catch {
      // Fall back to text search if embedding fails
      const allPatterns = await this.semanticMemory.getAllPatterns();
      const lowerQuery = query.toLowerCase();

      return allPatterns
        .filter(
          (p) =>
            p.name.toLowerCase().includes(lowerQuery) ||
            p.description.toLowerCase().includes(lowerQuery) ||
            p.debtType.toLowerCase().includes(lowerQuery),
        )
        .slice(0, this.maxPatterns);
    }
  }

  /**
   * Retrieve historical context for analysis
   */
  async retrieveHistoricalContext(
    repositoryId: string,
    filePath?: string,
  ): Promise<HistoricalContext> {
    // Get recent scans
    const repoHistory = await this.episodicMemory.getRepoHistory(repositoryId, 5);

    // Collect findings from recent scans
    const allFindings: DebtFinding[] = [];
    const allFeedback: UserFeedback[] = [];

    for (const scanSummary of repoHistory) {
      const scan = await this.episodicMemory.getScanById(scanSummary.id);
      if (scan) {
        allFindings.push(...scan.findings);
      }
    }

    // Filter by file path if provided
    let relevantFindings = allFindings;
    if (filePath) {
      relevantFindings = allFindings.filter((f) => f.filePath === filePath);
    }

    // Separate previous and resolved findings
    const previousFindings = relevantFindings
      .filter((f) => !this.isFindingResolved(f))
      .slice(0, this.maxHistoricalFindings);

    const resolvedFindings = relevantFindings
      .filter((f) => this.isFindingResolved(f))
      .slice(0, this.maxHistoricalFindings);

    // Get feedback for these findings
    for (const finding of [...previousFindings, ...resolvedFindings]) {
      const pattern: DebtPattern = {
        id: '',
        name: '',
        description: '',
        debtType: finding.debtType,
        codePattern: '',
        embedding: [],
        examples: [],
        validationStats: { totalMatches: 0, confirmedValid: 0, confirmedFalsePositive: 0, precision: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const feedbackItems = await this.episodicMemory.getFeedbackForPattern(pattern);
      allFeedback.push(...feedbackItems);
    }

    // Get related patterns
    const debtTypes = [...new Set(relevantFindings.map((f) => f.debtType))];
    const relatedPatterns: DebtPattern[] = [];

    for (const debtType of debtTypes.slice(0, 3)) {
      const patterns = await this.semanticMemory.getAllPatterns();
      const matching = patterns.filter((p) => p.debtType === debtType);
      relatedPatterns.push(...matching.slice(0, 2));
    }

    return {
      previousFindings,
      resolvedFindings,
      feedback: allFeedback.slice(0, 20),
      relatedPatterns: relatedPatterns.slice(0, this.maxPatterns),
    };
  }

  /**
   * Build context specifically for debt analysis
   */
  async buildAnalysisContext(
    code: string,
    filePath: string,
    repositoryId: string,
    language?: string,
  ): Promise<RAGContext> {
    // Create a query combining code context
    const query = `Analyze ${language || 'code'} file for technical debt: ${filePath}`;

    // Get base context
    const context = await this.buildContext(query, repositoryId, filePath);

    // Enhance with file-specific chunks
    const fileChunks = await this.embeddingService.searchSimilar({
      query: code.slice(0, 500), // Use beginning of code as query
      repositoryId,
      limit: 5,
      threshold: 0.6,
    });

    // Merge and dedupe chunks
    const allChunks = [...context.retrievedChunks, ...fileChunks];
    const uniqueChunks = this.dedupeChunks(allChunks);

    return {
      ...context,
      retrievedChunks: uniqueChunks.slice(0, this.maxChunks),
    };
  }

  /**
   * Build context for reflection/validation
   */
  async buildReflectionContext(
    finding: DebtFinding,
    repositoryId: string,
  ): Promise<RAGContext> {
    const query = `Validate ${finding.debtType} finding: ${finding.title}`;

    // Get base context
    const context = await this.buildContext(query, repositoryId, finding.filePath);

    // Get specific feedback for this type of finding
    const pattern: DebtPattern = {
      id: '',
      name: finding.title,
      description: finding.description,
      debtType: finding.debtType,
      codePattern: '',
      embedding: [],
      examples: [],
      validationStats: { totalMatches: 0, confirmedValid: 0, confirmedFalsePositive: 0, precision: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const specificFeedback = await this.episodicMemory.getFeedbackForPattern(pattern);

    return {
      ...context,
      historicalContext: {
        ...context.historicalContext,
        feedback: [
          ...specificFeedback,
          ...context.historicalContext.feedback,
        ].slice(0, 30),
      },
    };
  }

  /**
   * Format context for LLM prompt
   */
  formatContextForPrompt(context: RAGContext): string {
    const sections: string[] = [];

    // Add retrieved code chunks
    if (context.retrievedChunks.length > 0) {
      sections.push('## Relevant Code from Repository\n');
      for (const chunk of context.retrievedChunks.slice(0, 5)) {
        sections.push(`### ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})`);
        sections.push('```');
        sections.push(chunk.content);
        sections.push('```\n');
      }
    }

    // Add relevant patterns
    if (context.relevantPatterns.length > 0) {
      sections.push('## Known Debt Patterns\n');
      for (const pattern of context.relevantPatterns) {
        sections.push(`### ${pattern.name} (${pattern.debtType})`);
        sections.push(pattern.description);
        sections.push(`Precision: ${(pattern.validationStats.precision * 100).toFixed(1)}%\n`);
      }
    }

    // Add historical context
    const { previousFindings, resolvedFindings, feedback } = context.historicalContext;

    if (previousFindings.length > 0) {
      sections.push('## Previous Findings in This Area\n');
      for (const finding of previousFindings.slice(0, 5)) {
        sections.push(`- [${finding.severity}] ${finding.title} (${finding.filePath})`);
      }
      sections.push('');
    }

    if (resolvedFindings.length > 0) {
      sections.push('## Recently Resolved Issues\n');
      for (const finding of resolvedFindings.slice(0, 3)) {
        sections.push(`- ${finding.title} - ${finding.suggestedFix || 'No fix recorded'}`);
      }
      sections.push('');
    }

    // Add feedback summary
    if (feedback.length > 0) {
      const validCount = feedback.filter((f) => f.feedbackType === 'valid').length;
      const falsePositiveCount = feedback.filter((f) => f.feedbackType === 'false_positive').length;

      sections.push('## Team Feedback History\n');
      sections.push(`- Confirmed valid: ${validCount}`);
      sections.push(`- Marked as false positive: ${falsePositiveCount}`);
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Check if a finding is resolved (simple heuristic)
   */
  private isFindingResolved(finding: DebtFinding): boolean {
    // In a real implementation, this would check the finding's status
    // For now, use a simple heuristic based on fingerprint tracking
    return false;
  }

  /**
   * Deduplicate chunks by content similarity
   */
  private dedupeChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
    const seen = new Set<string>();
    const unique: RetrievedChunk[] = [];

    for (const chunk of chunks) {
      const key = `${chunk.filePath}:${chunk.startLine}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(chunk);
      }
    }

    // Sort by similarity
    return unique.sort((a, b) => b.similarity - a.similarity);
  }
}

export function createRAGPipeline(config: RAGPipelineConfig): RAGPipeline {
  return new RAGPipeline(config);
}
