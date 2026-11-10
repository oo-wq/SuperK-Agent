import type { Chunk } from "./chunker";

export interface StoredChunk extends Chunk {
  embedding: number[];
  addedAt: number;
}

export class VectorStore {
  private chunks: StoredChunk[] = []; // 内存向量库

  add(chunk: Chunk, embedding: number[]): void {
    const existing = this.chunks.findIndex((c) => c.id === chunk.id);
    const stored: StoredChunk = {
      ...chunk,
      embedding,
      addedAt: Date.now(),
    };
    if (existing >= 0) {
      this.chunks[existing] = stored;
    } else {
      this.chunks.push(stored);
    }
  }

  addBatch(items: { chunk: Chunk; embedding: number[] }[]): void {
    for (const { chunk, embedding } of items) {
      this.add(chunk, embedding);
    }
  }

  getAll(): StoredChunk[] {
    return this.chunks;
  }

  size(): number {
    return this.chunks.length;
  }

  clear(): void {
    this.chunks = [];
  }

  sources(): string[] {
    return [...new Set(this.chunks.map((c) => c.source))];
  }
}
