import OpenAI from 'openai';
import {
  EmbeddingConfig,
  EmbeddingResult,
  Chunk,
  ChunkEmbedding,
  FileEmbedding,
} from './types';
import { CodeChunker } from './chunker';

export class Embedder {
  private client: OpenAI;
  private config: EmbeddingConfig;
  private chunker: CodeChunker;

  constructor(config: EmbeddingConfig) {
    this.config = {
      model: config.model || 'text-embedding-3-small',
      dimensions: config.dimensions || 1536,
      apiKey: config.apiKey,
    };

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
    });

    this.chunker = new CodeChunker({
      maxTokens: 1500,
      overlapTokens: 200,
      strategy: 'semantic',
    });
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const response = await this.client.embeddings.create({
      model: this.config.model,
      input: text,
      dimensions: this.config.dimensions,
    });

    return {
      embedding: response.data[0].embedding,
      tokenCount: response.usage.total_tokens,
    };
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) return [];

    // OpenAI allows up to 2048 inputs per request
    const batchSize = 100;
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const response = await this.client.embeddings.create({
        model: this.config.model,
        input: batch,
        dimensions: this.config.dimensions,
      });

      // Calculate per-text token usage (approximate)
      const avgTokens = Math.ceil(response.usage.total_tokens / batch.length);

      for (const item of response.data) {
        results.push({
          embedding: item.embedding,
          tokenCount: avgTokens,
        });
      }
    }

    return results;
  }

  /**
   * Embed a source file (chunk + embed)
   */
  async embedFile(
    content: string,
    filePath: string,
    fileSnapshotId: string,
  ): Promise<FileEmbedding> {
    // Chunk the file
    const chunks = this.chunker.chunk(content, filePath);

    if (chunks.length === 0) {
      return {
        fileSnapshotId,
        filePath,
        chunks: [],
      };
    }

    // Embed all chunks
    const embeddings = await this.embedBatch(chunks.map((c) => c.content));

    // Combine chunks with embeddings
    const chunkEmbeddings: ChunkEmbedding[] = chunks.map((chunk, index) => ({
      chunkIndex: index,
      content: chunk.content,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      embedding: embeddings[index].embedding,
      tokenCount: embeddings[index].tokenCount,
    }));

    return {
      fileSnapshotId,
      filePath,
      chunks: chunkEmbeddings,
    };
  }

  /**
   * Embed a query for similarity search
   */
  async embedQuery(query: string): Promise<number[]> {
    const result = await this.embed(query);
    return result.embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get embedding dimensions
   */
  getDimensions(): number {
    return this.config.dimensions;
  }

  /**
   * Get model name
   */
  getModel(): string {
    return this.config.model;
  }
}

/**
 * Factory function to create embedder with environment config
 */
export function createEmbedder(apiKey?: string): Embedder {
  const key = apiKey || process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error('OpenAI API key is required');
  }

  return new Embedder({
    model: 'text-embedding-3-small',
    dimensions: 1536,
    apiKey: key,
  });
}
