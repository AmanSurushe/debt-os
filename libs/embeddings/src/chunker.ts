import { Chunk, ChunkingConfig, ChunkMetadata, detectLanguage } from './types';
import { v4 as uuidv4 } from 'uuid';

// Simple token estimation (roughly 4 chars per token for code)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class CodeChunker {
  private config: ChunkingConfig;

  constructor(config: Partial<ChunkingConfig> = {}) {
    this.config = {
      maxTokens: config.maxTokens || 1500,
      overlapTokens: config.overlapTokens || 200,
      strategy: config.strategy || 'semantic',
    };
  }

  /**
   * Chunk a source file into semantically meaningful pieces
   */
  chunk(content: string, filePath: string): Chunk[] {
    const language = detectLanguage(filePath);
    const lines = content.split('\n');

    if (this.config.strategy === 'semantic' && language) {
      return this.semanticChunk(lines, filePath, language);
    }

    return this.fixedChunk(lines, filePath, language);
  }

  /**
   * Semantic chunking - tries to find natural boundaries (functions, classes)
   */
  private semanticChunk(
    lines: string[],
    filePath: string,
    language: string,
  ): Chunk[] {
    const chunks: Chunk[] = [];
    const boundaries = this.findSemanticBoundaries(lines, language);

    if (boundaries.length === 0) {
      // No semantic boundaries found, fall back to fixed chunking
      return this.fixedChunk(lines, filePath, language);
    }

    // Add start boundary
    boundaries.unshift({ line: 0, type: 'file', name: undefined });
    boundaries.push({ line: lines.length, type: 'file', name: undefined });

    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i].line;
      const end = boundaries[i + 1].line;
      const chunkLines = lines.slice(start, end);
      const content = chunkLines.join('\n');
      const tokenCount = estimateTokens(content);

      // If chunk is too large, split it further
      if (tokenCount > this.config.maxTokens) {
        const subChunks = this.splitLargeChunk(
          chunkLines,
          start,
          filePath,
          language,
          boundaries[i].type,
          boundaries[i].name,
        );
        chunks.push(...subChunks);
      } else if (tokenCount > 50) {
        // Only include chunks with meaningful content
        chunks.push({
          id: uuidv4(),
          content,
          startLine: start + 1,
          endLine: end,
          tokenCount,
          metadata: {
            filePath,
            language,
            type: boundaries[i].type as Chunk['metadata']['type'],
            name: boundaries[i].name,
          },
        });
      }
    }

    return this.mergeSmallChunks(chunks);
  }

  /**
   * Find semantic boundaries (function/class definitions)
   */
  private findSemanticBoundaries(
    lines: string[],
    language: string,
  ): Array<{ line: number; type: string; name?: string }> {
    const boundaries: Array<{ line: number; type: string; name?: string }> = [];

    // Language-specific patterns
    const patterns = this.getLanguagePatterns(language);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
        continue;
      }

      for (const pattern of patterns) {
        const match = trimmed.match(pattern.regex);
        if (match) {
          boundaries.push({
            line: i,
            type: pattern.type,
            name: match[1],
          });
          break;
        }
      }
    }

    return boundaries;
  }

  /**
   * Get regex patterns for different languages
   */
  private getLanguagePatterns(
    language: string,
  ): Array<{ regex: RegExp; type: string }> {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return [
          { regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/, type: 'function' },
          { regex: /^(?:export\s+)?class\s+(\w+)/, type: 'class' },
          { regex: /^(?:export\s+)?interface\s+(\w+)/, type: 'class' },
          { regex: /^(?:export\s+)?type\s+(\w+)/, type: 'class' },
          { regex: /^(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/, type: 'function' },
          { regex: /^(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/, type: 'function' },
        ];

      case 'python':
        return [
          { regex: /^def\s+(\w+)\s*\(/, type: 'function' },
          { regex: /^async\s+def\s+(\w+)\s*\(/, type: 'function' },
          { regex: /^class\s+(\w+)/, type: 'class' },
        ];

      case 'go':
        return [
          { regex: /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/, type: 'function' },
          { regex: /^type\s+(\w+)\s+struct/, type: 'class' },
          { regex: /^type\s+(\w+)\s+interface/, type: 'class' },
        ];

      case 'rust':
        return [
          { regex: /^(?:pub\s+)?fn\s+(\w+)/, type: 'function' },
          { regex: /^(?:pub\s+)?struct\s+(\w+)/, type: 'class' },
          { regex: /^(?:pub\s+)?enum\s+(\w+)/, type: 'class' },
          { regex: /^(?:pub\s+)?trait\s+(\w+)/, type: 'class' },
          { regex: /^impl(?:<[^>]+>)?\s+(\w+)/, type: 'class' },
        ];

      case 'java':
      case 'kotlin':
        return [
          { regex: /^(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/, type: 'function' },
          { regex: /^(?:public|private|protected)?\s*(?:abstract\s+)?class\s+(\w+)/, type: 'class' },
          { regex: /^(?:public|private|protected)?\s*interface\s+(\w+)/, type: 'class' },
        ];

      default:
        return [
          { regex: /^(?:function|def|fn|func)\s+(\w+)/, type: 'function' },
          { regex: /^class\s+(\w+)/, type: 'class' },
        ];
    }
  }

  /**
   * Split a large chunk into smaller pieces
   */
  private splitLargeChunk(
    lines: string[],
    startOffset: number,
    filePath: string,
    language: string | null,
    type: string,
    name?: string,
  ): Chunk[] {
    const chunks: Chunk[] = [];
    const maxLines = Math.floor(this.config.maxTokens / 10); // Rough estimate
    const overlapLines = Math.floor(this.config.overlapTokens / 10);

    let i = 0;
    while (i < lines.length) {
      const end = Math.min(i + maxLines, lines.length);
      const chunkLines = lines.slice(i, end);
      const content = chunkLines.join('\n');
      const tokenCount = estimateTokens(content);

      if (tokenCount > 50) {
        chunks.push({
          id: uuidv4(),
          content,
          startLine: startOffset + i + 1,
          endLine: startOffset + end,
          tokenCount,
          metadata: {
            filePath,
            language,
            type: type as Chunk['metadata']['type'],
            name,
          },
        });
      }

      i = end - overlapLines;
      if (i >= lines.length - overlapLines) break;
    }

    return chunks;
  }

  /**
   * Fixed-size chunking as fallback
   */
  private fixedChunk(
    lines: string[],
    filePath: string,
    language: string | null,
  ): Chunk[] {
    const chunks: Chunk[] = [];
    const maxLines = Math.floor(this.config.maxTokens / 10);
    const overlapLines = Math.floor(this.config.overlapTokens / 10);

    let i = 0;
    while (i < lines.length) {
      const end = Math.min(i + maxLines, lines.length);
      const chunkLines = lines.slice(i, end);
      const content = chunkLines.join('\n');
      const tokenCount = estimateTokens(content);

      if (tokenCount > 50) {
        chunks.push({
          id: uuidv4(),
          content,
          startLine: i + 1,
          endLine: end,
          tokenCount,
          metadata: {
            filePath,
            language,
            type: 'block',
          },
        });
      }

      i = end - overlapLines;
      if (i >= lines.length - overlapLines) break;
    }

    return chunks;
  }

  /**
   * Merge small adjacent chunks
   */
  private mergeSmallChunks(chunks: Chunk[]): Chunk[] {
    if (chunks.length <= 1) return chunks;

    const merged: Chunk[] = [];
    let current = chunks[0];

    for (let i = 1; i < chunks.length; i++) {
      const next = chunks[i];
      const combinedTokens = current.tokenCount + next.tokenCount;

      // Merge if combined is still under limit and chunks are adjacent
      if (
        combinedTokens < this.config.maxTokens * 0.8 &&
        current.endLine === next.startLine - 1 &&
        current.tokenCount < 200
      ) {
        current = {
          id: current.id,
          content: current.content + '\n' + next.content,
          startLine: current.startLine,
          endLine: next.endLine,
          tokenCount: combinedTokens,
          metadata: current.metadata,
        };
      } else {
        merged.push(current);
        current = next;
      }
    }

    merged.push(current);
    return merged;
  }
}
