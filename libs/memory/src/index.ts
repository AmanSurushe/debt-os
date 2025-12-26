// Types
export * from './types';

// Memory implementations
export { createEpisodicMemory, EpisodicMemoryImpl } from './episodic';
export type { EpisodicMemoryConfig } from './episodic';

export { createSemanticMemory, SemanticMemoryImpl, DEFAULT_DEBT_PATTERNS } from './semantic';
export type { SemanticMemoryConfig } from './semantic';

export { createTemporalMemory, TemporalMemoryImpl } from './temporal';
export type { TemporalMemoryConfig } from './temporal';

// RAG Pipeline
export { createRAGPipeline, RAGPipeline } from './rag';
export type { RAGPipelineConfig, EmbeddingService } from './rag';

// Storage
export { createPostgresStorage, PostgresStorage } from './storage/postgres';
export type { PostgresStorageConfig } from './storage/postgres';

// Unified Memory System Factory
import {
  MemorySystem,
  EpisodicMemory,
  SemanticMemory,
  TemporalMemory,
  MemoryStorage,
} from './types';
import { createEpisodicMemory } from './episodic';
import { createSemanticMemory } from './semantic';
import { createTemporalMemory } from './temporal';

export interface CreateMemorySystemConfig {
  storage: MemoryStorage;
  maxHistoryPerRepo?: number;
  defaultSimilarityThreshold?: number;
}

export function createMemorySystem(config: CreateMemorySystemConfig): MemorySystem {
  const episodic = createEpisodicMemory({
    storage: config.storage,
    maxHistoryPerRepo: config.maxHistoryPerRepo,
  });

  const semantic = createSemanticMemory({
    storage: config.storage,
    defaultSimilarityThreshold: config.defaultSimilarityThreshold,
  });

  const temporal = createTemporalMemory({
    storage: config.storage,
  });

  return {
    episodic,
    semantic,
    temporal,
  };
}
