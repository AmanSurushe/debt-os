import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { FileSnapshot } from '../scan/entities/file-snapshot.entity';
import { FileEmbedding } from '../scan/entities/file-embedding.entity';
import {
  Embedder,
  createEmbedder,
  SimilaritySearchOptions,
  SimilarityResult,
} from '@debt-os/embeddings';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private embedder: Embedder;

  constructor(
    @InjectRepository(FileSnapshot)
    private fileSnapshotRepository: Repository<FileSnapshot>,
    @InjectRepository(FileEmbedding)
    private fileEmbeddingRepository: Repository<FileEmbedding>,
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.embedder = createEmbedder(apiKey);
    }
  }

  /**
   * Embed a file and store the embeddings in the database
   */
  async embedFile(
    fileSnapshotId: string,
    content: string,
    filePath: string,
  ): Promise<void> {
    if (!this.embedder) {
      throw new Error('Embedder not initialized - missing OPENAI_API_KEY');
    }

    this.logger.log(`Embedding file: ${filePath}`);

    // Update status to processing
    await this.fileSnapshotRepository.update(fileSnapshotId, {
      embeddingStatus: 'processing',
    });

    try {
      // Generate embeddings using the library
      const fileEmbedding = await this.embedder.embedFile(
        content,
        filePath,
        fileSnapshotId,
      );

      // Store each chunk embedding
      for (const chunk of fileEmbedding.chunks) {
        // Use raw query for vector insertion since TypeORM doesn't handle vector type
        await this.dataSource.query(
          `INSERT INTO file_embeddings
           (file_snapshot_id, chunk_index, content, start_line, end_line, token_count, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
           ON CONFLICT (file_snapshot_id, chunk_index)
           DO UPDATE SET content = $3, start_line = $4, end_line = $5, token_count = $6, embedding = $7::vector`,
          [
            fileSnapshotId,
            chunk.chunkIndex,
            chunk.content,
            chunk.startLine,
            chunk.endLine,
            chunk.tokenCount,
            `[${chunk.embedding.join(',')}]`,
          ],
        );
      }

      // Update status to complete
      await this.fileSnapshotRepository.update(fileSnapshotId, {
        embeddingStatus: 'complete',
      });

      this.logger.log(
        `Embedded ${fileEmbedding.chunks.length} chunks for ${filePath}`,
      );
    } catch (error) {
      this.logger.error(`Failed to embed file ${filePath}:`, error);
      await this.fileSnapshotRepository.update(fileSnapshotId, {
        embeddingStatus: 'failed',
      });
      throw error;
    }
  }

  /**
   * Search for similar code chunks using vector similarity
   */
  async searchSimilar(
    options: SimilaritySearchOptions,
  ): Promise<SimilarityResult[]> {
    if (!this.embedder) {
      throw new Error('Embedder not initialized - missing OPENAI_API_KEY');
    }

    const { query, repositoryId, limit = 10, threshold = 0.7, filters } = options;

    // Generate query embedding
    const queryEmbedding = await this.embedder.embedQuery(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Build the query with filters
    let sql = `
      SELECT
        fe.id,
        fs.id as file_snapshot_id,
        fs.file_path,
        fe.chunk_index,
        fe.content,
        fe.start_line,
        fe.end_line,
        1 - (fe.embedding <=> $1::vector) as similarity
      FROM file_embeddings fe
      JOIN file_snapshots fs ON fe.file_snapshot_id = fs.id
      JOIN scans s ON fs.scan_id = s.id
      WHERE s.repository_id = $2
        AND 1 - (fe.embedding <=> $1::vector) >= $3
    `;

    const params: any[] = [embeddingStr, repositoryId, threshold];
    let paramIndex = 4;

    // Apply filters
    if (filters?.scanId) {
      sql += ` AND s.id = $${paramIndex}`;
      params.push(filters.scanId);
      paramIndex++;
    }

    if (filters?.fileTypes && filters.fileTypes.length > 0) {
      const extensions = filters.fileTypes.map((ft) =>
        ft.startsWith('.') ? ft : `.${ft}`,
      );
      sql += ` AND (${extensions.map((_, i) => `fs.file_path LIKE $${paramIndex + i}`).join(' OR ')})`;
      extensions.forEach((ext) => params.push(`%${ext}`));
      paramIndex += extensions.length;
    }

    if (filters?.paths && filters.paths.length > 0) {
      sql += ` AND (${filters.paths.map((_, i) => `fs.file_path LIKE $${paramIndex + i}`).join(' OR ')})`;
      filters.paths.forEach((path) => params.push(`${path}%`));
      paramIndex += filters.paths.length;
    }

    sql += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const results = await this.dataSource.query(sql, params);

    return results.map((row: any) => ({
      fileSnapshotId: row.file_snapshot_id,
      filePath: row.file_path,
      chunkIndex: row.chunk_index,
      content: row.content,
      startLine: row.start_line,
      endLine: row.end_line,
      similarity: parseFloat(row.similarity),
    }));
  }

  /**
   * Get embedding statistics for a repository
   */
  async getRepositoryStats(repositoryId: string): Promise<{
    totalFiles: number;
    embeddedFiles: number;
    pendingFiles: number;
    failedFiles: number;
    totalChunks: number;
  }> {
    const result = await this.dataSource.query(
      `
      SELECT
        COUNT(*) as total_files,
        COUNT(*) FILTER (WHERE fs.embedding_status = 'complete') as embedded_files,
        COUNT(*) FILTER (WHERE fs.embedding_status = 'pending') as pending_files,
        COUNT(*) FILTER (WHERE fs.embedding_status = 'failed') as failed_files,
        COALESCE(SUM(chunk_counts.chunk_count), 0) as total_chunks
      FROM file_snapshots fs
      JOIN scans s ON fs.scan_id = s.id
      LEFT JOIN (
        SELECT file_snapshot_id, COUNT(*) as chunk_count
        FROM file_embeddings
        GROUP BY file_snapshot_id
      ) chunk_counts ON chunk_counts.file_snapshot_id = fs.id
      WHERE s.repository_id = $1
    `,
      [repositoryId],
    );

    const row = result[0];
    return {
      totalFiles: parseInt(row.total_files, 10),
      embeddedFiles: parseInt(row.embedded_files, 10),
      pendingFiles: parseInt(row.pending_files, 10),
      failedFiles: parseInt(row.failed_files, 10),
      totalChunks: parseInt(row.total_chunks, 10),
    };
  }

  /**
   * Check if embedder is configured
   */
  isConfigured(): boolean {
    return !!this.embedder;
  }
}
