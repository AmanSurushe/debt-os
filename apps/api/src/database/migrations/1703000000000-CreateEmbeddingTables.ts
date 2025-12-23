import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmbeddingTables1703000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure pgvector extension is enabled (should already be from init script)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // Create file_snapshots table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS file_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id UUID NOT NULL,
        file_path VARCHAR NOT NULL,
        content_hash VARCHAR NOT NULL,
        language VARCHAR,
        line_count INTEGER NOT NULL,
        size_bytes INTEGER NOT NULL,
        analyzed_at TIMESTAMPTZ,
        embedding_status VARCHAR DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),

        CONSTRAINT fk_file_snapshots_scan
          FOREIGN KEY (scan_id)
          REFERENCES scans(id)
          ON DELETE CASCADE,

        CONSTRAINT uq_file_snapshots_scan_path
          UNIQUE (scan_id, file_path)
      )
    `);

    // Create indexes for file_snapshots
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_file_snapshots_scan_id
      ON file_snapshots(scan_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_file_snapshots_embedding_status
      ON file_snapshots(embedding_status)
    `);

    // Create file_embeddings table with vector column
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS file_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_snapshot_id UUID NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        token_count INTEGER NOT NULL,
        embedding vector(1536) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),

        CONSTRAINT fk_file_embeddings_snapshot
          FOREIGN KEY (file_snapshot_id)
          REFERENCES file_snapshots(id)
          ON DELETE CASCADE,

        CONSTRAINT uq_file_embeddings_snapshot_chunk
          UNIQUE (file_snapshot_id, chunk_index)
      )
    `);

    // Create HNSW index for fast similarity search
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_file_embeddings_vector
      ON file_embeddings
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);

    // Create regular indexes for filtering
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_file_embeddings_snapshot_id
      ON file_embeddings(file_snapshot_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS file_embeddings CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS file_snapshots CASCADE`);
  }
}
