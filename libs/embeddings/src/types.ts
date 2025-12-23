export interface EmbeddingConfig {
  model: 'text-embedding-3-small' | 'text-embedding-3-large';
  dimensions: number;
  apiKey: string;
}

export interface ChunkingConfig {
  maxTokens: number;
  overlapTokens: number;
  strategy: 'semantic' | 'fixed';
}

export interface Chunk {
  id: string;
  content: string;
  startLine: number;
  endLine: number;
  tokenCount: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  filePath: string;
  language: string | null;
  type: 'function' | 'class' | 'module' | 'block' | 'file';
  name?: string;
}

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

export interface FileEmbedding {
  fileSnapshotId: string;
  filePath: string;
  chunks: ChunkEmbedding[];
}

export interface ChunkEmbedding {
  chunkIndex: number;
  content: string;
  startLine: number;
  endLine: number;
  embedding: number[];
  tokenCount: number;
}

export interface SimilaritySearchOptions {
  query: string;
  repositoryId: string;
  limit?: number;
  threshold?: number;
  filters?: {
    fileTypes?: string[];
    paths?: string[];
    scanId?: string;
  };
}

export interface SimilarityResult {
  fileSnapshotId: string;
  filePath: string;
  chunkIndex: number;
  content: string;
  startLine: number;
  endLine: number;
  similarity: number;
}

// Language detection based on file extension
export const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'c',
  '.hpp': 'cpp',
  '.swift': 'swift',
  '.scala': 'scala',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

export function detectLanguage(filePath: string): string | null {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  return LANGUAGE_MAP[ext] || null;
}
