import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSnapshotTables1703000002000 implements MigrationInterface {
  name = 'CreateSnapshotTables1703000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure pgvector extension is enabled
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // Create file_snapshots table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS file_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
        file_path VARCHAR(1000) NOT NULL,
        content_hash VARCHAR(64) NOT NULL,
        language VARCHAR(50),
        line_count INTEGER NOT NULL DEFAULT 0,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        embedding vector(1536),
        analyzed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes for file_snapshots
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_file_snapshots_scan_id ON file_snapshots(scan_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_file_snapshots_file_path ON file_snapshots(file_path)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_file_snapshots_language ON file_snapshots(language)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_file_snapshots_content_hash ON file_snapshots(content_hash)
    `);

    // Create HNSW index for vector similarity search
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_file_snapshots_embedding
      ON file_snapshots USING hnsw (embedding vector_cosine_ops)
    `);

    // Create commit_info table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS commit_info (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        sha VARCHAR(40) NOT NULL,
        message TEXT NOT NULL,
        author_name VARCHAR(255) NOT NULL,
        author_email VARCHAR(255) NOT NULL,
        authored_at TIMESTAMP WITH TIME ZONE NOT NULL,
        embedding vector(1536),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(repository_id, sha)
      )
    `);

    // Create indexes for commit_info
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_commit_info_repository_id ON commit_info(repository_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_commit_info_sha ON commit_info(sha)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_commit_info_authored_at ON commit_info(authored_at)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_commit_info_author ON commit_info(author_email)
    `);

    // Create HNSW index for vector similarity search on commit messages
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_commit_info_embedding
      ON commit_info USING hnsw (embedding vector_cosine_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS commit_info`);
    await queryRunner.query(`DROP TABLE IF EXISTS file_snapshots`);
  }
}
