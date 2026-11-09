import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import type { Chunk } from "./chunker.js";
import type { StoredChunk } from "./store.js";
import { DIMS, embed, type EmbeddingFn } from "./embedder";
import type { SearchResult } from "./search";

const DEFAULT_DB_PATH = "knowledge.db"; // 默认数据库文件
const CHARS_PER_TOKEN = 4; // 每个 token 对应的字符数
const CANDIDATE_MULTIPLIER = 4; // 候选集相对 topK 的倍数
const VECTOR_WEIGHT = 0.7; // 向量检索权重
const KEYWORD_WEIGHT = 0.3; // 关键词检索权重
const MMR_LAMBDA = 0.7; // MMR 参数：70% 看相关性，30% 看多样性

// 检索查询返回的行结构（embedding 以 JSON 字符串存储）
interface ChunkRow {
  id: string;
  text: string;
  source: string;
  chunk_index: number;
  embedding: string;
}

interface VectorRow extends ChunkRow {
  distance: number;
}

interface KeywordRow extends ChunkRow {
  rank: number;
}

// 将查询行映射为内存中的 StoredChunk
function toStoredChunk(row: ChunkRow): StoredChunk {
  return {
    id: row.id,
    text: row.text,
    source: row.source,
    index: row.chunk_index,
    tokenEstimate: Math.ceil(row.text.length / CHARS_PER_TOKEN),
    embedding: JSON.parse(row.embedding),
    addedAt: 0,
  };
}

export class SqliteVectorStore {
  private db: Database.Database;

  constructor(dbPath: string = DEFAULT_DB_PATH) {
    this.db = new Database(dbPath);
    sqliteVec.load(this.db); // 加载向量搜索扩展
    this.createTables();
  }

  private createTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        source TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        embedding TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT 'text-embedding-v3',
        updated_at INTEGER NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
        id TEXT PRIMARY KEY,
        embedding FLOAT[${DIMS}]
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        text, id UNINDEXED, source UNINDEXED
      );
    `);
  }

  add(chunk: Chunk, embedding: number[]): void {
    const now = Date.now();
    // 三表联动写入
    this.db
      .prepare(
        `INSERT OR REPLACE INTO chunks
      (id, text, source, chunk_index, embedding, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        chunk.id,
        chunk.text,
        chunk.source,
        chunk.index,
        JSON.stringify(embedding),
        now,
      );

    this.db
      .prepare(
        `INSERT OR REPLACE INTO chunks_vec (id, embedding)
      VALUES (?, ?)`,
      )
      .run(chunk.id, Buffer.from(new Float32Array(embedding).buffer));

    this.db
      .prepare(
        `INSERT OR REPLACE INTO chunks_fts (id, text, source)
      VALUES (?, ?, ?)`,
      )
      .run(chunk.id, chunk.text, chunk.source);
  }

  addBatch(items: { chunk: Chunk; embedding: number[] }[]): void {
    const tx = this.db.transaction(() => {
      for (const { chunk, embedding } of items) this.add(chunk, embedding);
    });
    tx(); // 事务批量写入，比逐条快很多
  }

  vectorSearch(
    queryEmbedding: number[],
    topK: number,
  ): { chunk: StoredChunk; score: number }[] {
    const buf = Buffer.from(new Float32Array(queryEmbedding).buffer);
    const rows = this.db
      .prepare<[Buffer, number], VectorRow>(
        `
      SELECT v.id, v.distance, c.text, c.source, c.chunk_index, c.embedding
      FROM chunks_vec v
      JOIN chunks c ON c.id = v.id
      WHERE v.embedding MATCH ?
      ORDER BY v.distance
      LIMIT ?
    `,
      )
      .all(buf, topK);

    return rows.map((row) => ({
      chunk: toStoredChunk(row),
      score: 1 - row.distance, // cosine distance → similarity
    }));
  }

  keywordSearch(
    query: string,
    topK: number,
  ): { chunk: StoredChunk; score: number }[] {
    const rows = this.db
      .prepare<[string, number], KeywordRow>(
        `
      SELECT f.id, bm25(chunks_fts) AS rank, c.text, c.source, c.chunk_index, c.embedding
      FROM chunks_fts f
      JOIN chunks c ON c.id = f.id
      WHERE chunks_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `,
      )
      .all(query, topK);

    return rows.map((row) => ({
      chunk: toStoredChunk(row),
      score: row.rank < 0 ? -row.rank / (1 - row.rank) : 1 / (1 + row.rank),
    }));
  }

  size(): number {
    const row = this.db
      .prepare<[], { n: number }>("SELECT COUNT(*) AS n FROM chunks")
      .get()!; // COUNT 始终返回一行
    return row.n;
  }

  clear(): void {
    this.db.exec(
      "DELETE FROM chunks; DELETE FROM chunks_vec; DELETE FROM chunks_fts;",
    );
  }

  sources(): string[] {
    const rows = this.db
      .prepare<[], { source: string }>("SELECT DISTINCT source FROM chunks")
      .all();
    return rows.map((row) => row.source);
  }

  // 混合搜索：直接在 SQLite 层完成向量 + 关键词双路检索
  async hybridSearch(
    embedFn: EmbeddingFn,
    query: string,
    topK: number = 5,
  ): Promise<SearchResult[]> {
    const candidateCount = Math.min(topK * CANDIDATE_MULTIPLIER, this.size());
    if (candidateCount === 0) return [];

    const [queryVec] = await embed(embedFn, [query]);

    // 路径 1：sqlite-vec 向量搜索
    const vectorResults = this.vectorSearch(queryVec, candidateCount);

    // 路径 2：FTS5 关键词搜索
    const keywordResults = this.keywordSearch(query, candidateCount);

    // 归一化 + 加权合并
    const vecScores = normalizeMinMax(vectorResults.map((r) => r.score));
    const kwScores = normalizeMinMax(keywordResults.map((r) => r.score));

    const candidates = new Map<string, SearchResult>();
    for (let i = 0; i < vectorResults.length; i++) {
      const id = vectorResults[i].chunk.id;
      candidates.set(id, {
        chunk: vectorResults[i].chunk,
        score: vecScores[i] * VECTOR_WEIGHT,
        vectorScore: vecScores[i],
        keywordScore: 0,
      });
    }
    for (let i = 0; i < keywordResults.length; i++) {
      const id = keywordResults[i].chunk.id;
      const existing = candidates.get(id);
      if (existing) {
        existing.keywordScore = kwScores[i];
        existing.score += kwScores[i] * KEYWORD_WEIGHT;
      } else {
        candidates.set(id, {
          chunk: keywordResults[i].chunk,
          score: kwScores[i] * KEYWORD_WEIGHT,
          vectorScore: 0,
          keywordScore: kwScores[i],
        });
      }
    }

    const sorted = [...candidates.values()].sort((a, b) => b.score - a.score);

    // MMR 去重，兼顾相关性与多样性
    return mmrSelect(sorted, topK);
  }
}

// 归一化：min-max 缩放到 [0, 1]
function normalizeMinMax(scores: number[]): number[] {
  if (scores.length === 0) return [];
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  return scores.map((s) => (s - min) / range);
}

// MMR 去重：每次选「相关性最高且与已选最不相似」的候选
function mmrSelect(results: SearchResult[], topK: number): SearchResult[] {
  if (results.length <= topK) return results;

  const selected: SearchResult[] = [results[0]];
  const remaining = results.slice(1);

  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = 0;
    let bestMmr = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const relevance = remaining[i].score;
      const maxSim = Math.max(
        ...selected.map((s) =>
          jaccardSimilarity(s.chunk.text, remaining[i].chunk.text),
        ),
      );
      const mmr = MMR_LAMBDA * relevance - (1 - MMR_LAMBDA) * maxSim;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

// 分词：小写化后按非词元字符切分，过滤单字符词
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}
