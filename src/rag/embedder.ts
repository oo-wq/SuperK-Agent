export type EmbeddingFn = (texts: string[]) => Promise<number[][]>;

const DASHSCOPE_EMBEDDINGS_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-v3";
export const DIMS = 128; // 嵌入输出维度

interface DashScopeEmbeddingResponse {
  data: { embedding: number[] }[];
}

export function createDashScopeEmbedder(apiKey: string): EmbeddingFn {
  return async (texts: string[]) => {
    const resp = await fetch(DASHSCOPE_EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts,
        dimensions: DIMS,
      }),
    });

    const data: DashScopeEmbeddingResponse = await resp.json();
    return data.data.map((item) => item.embedding);
  };
}

// 相同文本无需重复计算向量
const embedCache = new Map<string, number[]>();

export async function embed(
  fn: EmbeddingFn,
  texts: string[],
): Promise<number[][]> {
  const results: number[][] = new Array(texts.length);
  const uncached: { idx: number; text: string }[] = [];

  for (let i = 0; i < texts.length; i++) {
    const cached = embedCache.get(texts[i]);
    if (cached) {
      results[i] = cached;
    } else {
      uncached.push({ idx: i, text: texts[i] });
    }
  }

  if (uncached.length > 0) {
    const vectors = await fn(uncached.map((u) => u.text)); // 批量处理未缓存的文本
    for (let i = 0; i < uncached.length; i++) {
      results[uncached[i].idx] = vectors[i];
      embedCache.set(uncached[i].text, vectors[i]);
    }
  }

  return results;
}

// 计算两个向量之间的余弦相似度
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}
