import { MemoryStorage, QueryFilter, VectorSearchResult } from '../types';

/**
 * PostgreSQL-based storage implementation for the memory system
 * Uses TypeORM DataSource for database operations
 */
export interface PostgresStorageConfig {
  dataSource: {
    query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
  };
  tablePrefix?: string;
}

export class PostgresStorage implements MemoryStorage {
  private dataSource: PostgresStorageConfig['dataSource'];
  private tablePrefix: string;

  constructor(config: PostgresStorageConfig) {
    this.dataSource = config.dataSource;
    this.tablePrefix = config.tablePrefix || 'memory_';
  }

  /**
   * Store an item in a collection
   */
  async store<T>(collection: string, item: T): Promise<void> {
    const tableName = this.getTableName(collection);
    const itemWithId = item as Record<string, unknown>;

    // Build insert query
    const columns = Object.keys(itemWithId);
    const values = Object.values(itemWithId);
    const placeholders = values.map((_, i) => `$${i + 1}`);

    // Use JSONB for complex values
    const processedValues = values.map((v) =>
      typeof v === 'object' && v !== null && !(v instanceof Date)
        ? JSON.stringify(v)
        : v,
    );

    const sql = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (id) DO UPDATE SET
      ${columns.filter((c) => c !== 'id').map((c, i) => `${c} = $${i + 2}`).join(', ')}
    `;

    await this.dataSource.query(sql, processedValues);
  }

  /**
   * Get an item by ID
   */
  async get<T>(collection: string, id: string): Promise<T | null> {
    const tableName = this.getTableName(collection);

    const result = await this.dataSource.query(
      `SELECT * FROM ${tableName} WHERE id = $1`,
      [id],
    ) as Record<string, unknown>[];

    if (result.length === 0) return null;

    return this.deserializeRow(result[0]) as T;
  }

  /**
   * Query items with a filter
   */
  async query<T>(collection: string, filter: QueryFilter): Promise<T[]> {
    const tableName = this.getTableName(collection);
    const { field, operator, value } = filter;

    const operatorMap: Record<string, string> = {
      eq: '=',
      neq: '!=',
      gt: '>',
      gte: '>=',
      lt: '<',
      lte: '<=',
      in: 'IN',
      contains: 'LIKE',
    };

    const sqlOperator = operatorMap[operator] || '=';

    let sql: string;
    let params: unknown[];

    if (operator === 'in') {
      const placeholders = (value as unknown[]).map((_, i) => `$${i + 1}`).join(', ');
      sql = `SELECT * FROM ${tableName} WHERE ${field} IN (${placeholders})`;
      params = value as unknown[];
    } else if (operator === 'contains') {
      sql = `SELECT * FROM ${tableName} WHERE ${field} LIKE $1`;
      params = [`%${value}%`];
    } else {
      sql = `SELECT * FROM ${tableName} WHERE ${field} ${sqlOperator} $1`;
      params = [value];
    }

    const results = await this.dataSource.query(sql, params) as Record<string, unknown>[];
    return results.map((row) => this.deserializeRow(row) as T);
  }

  /**
   * Update an item
   */
  async update<T>(collection: string, id: string, updates: Partial<T>): Promise<void> {
    const tableName = this.getTableName(collection);
    const updateObj = updates as Record<string, unknown>;

    const columns = Object.keys(updateObj);
    const values = Object.values(updateObj);

    const setClause = columns.map((c, i) => `${c} = $${i + 1}`).join(', ');

    const processedValues = values.map((v) =>
      typeof v === 'object' && v !== null && !(v instanceof Date)
        ? JSON.stringify(v)
        : v,
    );

    await this.dataSource.query(
      `UPDATE ${tableName} SET ${setClause} WHERE id = $${columns.length + 1}`,
      [...processedValues, id],
    );
  }

  /**
   * Delete an item
   */
  async delete(collection: string, id: string): Promise<void> {
    const tableName = this.getTableName(collection);
    await this.dataSource.query(
      `DELETE FROM ${tableName} WHERE id = $1`,
      [id],
    );
  }

  /**
   * Store a vector embedding
   */
  async storeVector(collection: string, id: string, vector: number[]): Promise<void> {
    const tableName = this.getTableName(collection + '_vectors');
    const vectorStr = `[${vector.join(',')}]`;

    await this.dataSource.query(
      `INSERT INTO ${tableName} (id, embedding)
       VALUES ($1, $2::vector)
       ON CONFLICT (id) DO UPDATE SET embedding = $2::vector`,
      [id, vectorStr],
    );
  }

  /**
   * Search for similar vectors
   */
  async searchVectors(
    collection: string,
    query: number[],
    limit: number,
    threshold?: number,
  ): Promise<VectorSearchResult[]> {
    const tableName = this.getTableName(collection + '_vectors');
    const queryStr = `[${query.join(',')}]`;
    const effectiveThreshold = threshold || 0.5;

    const sql = `
      SELECT
        id,
        1 - (embedding <=> $1::vector) as similarity
      FROM ${tableName}
      WHERE 1 - (embedding <=> $1::vector) >= $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `;

    const results = await this.dataSource.query(sql, [queryStr, effectiveThreshold, limit]) as Array<{
      id: string;
      similarity: number;
    }>;

    return results.map((row) => ({
      id: row.id,
      similarity: parseFloat(String(row.similarity)),
    }));
  }

  /**
   * Ensure required tables exist
   */
  async ensureTables(): Promise<void> {
    const collections = [
      'scans',
      'scan_summaries',
      'findings',
      'feedback',
      'patterns',
      'rules',
      'debt_occurrences',
    ];

    for (const collection of collections) {
      await this.createTableIfNotExists(collection);
    }

    // Create vector tables
    await this.createVectorTableIfNotExists('pattern_embeddings');
  }

  private getTableName(collection: string): string {
    return `${this.tablePrefix}${collection}`;
  }

  private async createTableIfNotExists(collection: string): Promise<void> {
    const tableName = this.getTableName(collection);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create index on common fields
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_created ON ${tableName}(created_at)
    `);
  }

  private async createVectorTableIfNotExists(collection: string): Promise<void> {
    const tableName = this.getTableName(collection);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id UUID PRIMARY KEY,
        embedding vector(1536),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create vector index
    await this.dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_embedding ON ${tableName}
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    `);
  }

  private deserializeRow(row: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string') {
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value;
        }
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}

export function createPostgresStorage(config: PostgresStorageConfig): MemoryStorage {
  return new PostgresStorage(config);
}
