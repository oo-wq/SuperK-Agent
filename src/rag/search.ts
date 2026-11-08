import type { StoredChunk, VectorStore } from "./store";
import { cosineSimilarity, embed, type EmbeddingFn } from "./embedder";

export interface SearchResult {
  chunk: StoredChunk;
  score: number;
  vectorScore: number;
  keywordScore: number;
}

const VECTOR_WEIGHT = 0.7; // 向量检索权重
const KEYWORD_WEIGHT = 0.3; // 关键词检索权重
const CANDIDATE_MULTIPLIER = 4; // 候选集相对 topK 的倍数
const MMR_LAMBDA = 0.7; // MMR 参数：70% 看相关性，30% 看多样性

const BM25_K1 = 1.2; // BM25 词频饱和参数
const BM25_B = 0.75; // BM25 文档长度归一化参数
const NON_TOKEN_CHARS = /[^\w一-鿿]+/g; // 非词元字符（保留英文/数字/下划线/中文）

// 混合检索：向量检索 + 关键词检索（BM25），归一化加权后做 MMR 去重
export async function hybridSearch(
  store: VectorStore,
  embedFn: EmbeddingFn,
  query: string,
  topK: number = 5,
): Promise<SearchResult[]> {
  const all = store.getAll(); // 获取所有已存储的向量
  const candidateCount = Math.min(topK * CANDIDATE_MULTIPLIER, all.length);

  // 路径 1：向量检索
  const [queryVec] = await embed(embedFn, [query]); // 先将查询语句转成向量
  const vectorResults = all
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryVec, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, candidateCount);

  // 路径 2：关键词检索（BM25）
  const queryTerms = tokenize(query);
  const tokenizedDocs = all.map((d) => tokenize(d.text)); // 文档分词只计算一次
  const keywordResults = all
    .map((chunk, i) => ({
      chunk,
      score: bm25Score(queryTerms, tokenizedDocs[i], tokenizedDocs),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, candidateCount);

  // 归一化：两类分数量纲不同，需映射到同一区间后再加权
  const vecNorm = normalizeMinMax(vectorResults.map((r) => r.score));
  const kwNorm = normalizeViaSigmoid(keywordResults.map((r) => r.score)); // BM25 分数可能为负或很大，用 sigmoid 映射到 (0,1)

  // 合并结果
  const candidates = new Map<string, SearchResult>();
  for (let i = 0; i < vectorResults.length; i++) {
    const id = vectorResults[i].chunk.id;
    candidates.set(id, {
      chunk: vectorResults[i].chunk,
      score: vecNorm[i] * VECTOR_WEIGHT,
      vectorScore: vecNorm[i],
      keywordScore: 0,
    });
  }

  for (let i = 0; i < keywordResults.length; i++) {
    const id = keywordResults[i].chunk.id;
    const existing = candidates.get(id);
    if (existing) {
      existing.keywordScore = kwNorm[i];
      existing.score += kwNorm[i] * KEYWORD_WEIGHT;
    } else {
      candidates.set(id, {
        chunk: keywordResults[i].chunk,
        score: kwNorm[i] * KEYWORD_WEIGHT,
        vectorScore: 0,
        keywordScore: kwNorm[i],
      });
    }
  }

  const sorted = [...candidates.values()].sort((a, b) => b.score - a.score);

  // MMR 去重，兼顾相关性与多样性
  return mmrSelect(sorted, topK);
}

// 分词：小写化后按非词元字符切分，过滤单字符词
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(NON_TOKEN_CHARS, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

// BM25 计算文本匹配度
function bm25Score(
  queryTerms: string[],
  docTokens: string[],
  allDocTokens: string[][],
): number {
  const N = allDocTokens.length;
  const avgDl =
    allDocTokens.reduce((sum, tokens) => sum + tokens.length, 0) / (N || 1);
  const dl = docTokens.length;
  let score = 0;

  for (const term of queryTerms) {
    const tf = docTokens.filter((t) => t === term).length;
    const df = allDocTokens.filter((tokens) => tokens.includes(term)).length;
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
    const tfNorm =
      (tf * (BM25_K1 + 1)) /
      (tf + BM25_K1 * (1 - BM25_B + BM25_B * (dl / avgDl)));
    score += idf * tfNorm;
  }

  return score;
}

// 归一化：min-max 缩放到 [0, 1]
function normalizeMinMax(scores: number[]): number[] {
  if (scores.length === 0) return [];
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  return scores.map((s) => (s - min) / range);
}

// 归一化：sigmoid 将分数映射到 (0, 1)，保持相对顺序
function normalizeViaSigmoid(scores: number[]): number[] {
  return scores.map((s) => 1 / (1 + Math.exp(-s)));
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
