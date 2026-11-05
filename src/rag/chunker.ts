export interface Chunk {
  id: string;
  text: string;
  source: string;
  index: number;
  tokenEstimate: number;
}

const TARGET_TOKEN = 256; // 目标 token 数
const CHARS_PER_TOKEN = 4; // 每个 token 对应的字符数
const TARGET_CHARS = TARGET_TOKEN * CHARS_PER_TOKEN; // 单个分块的目标字符数

const PARAGRAPH_SPLIT = /\n{2,}/; // 按空行切分段落
const SENTENCE_SPLIT = /(?<=[。！？.!?])\s*/; // 按句末标点切分句子
const PARAGRAPH_SEPARATOR = "\n\n"; // 段落间连接符
const SENTENCE_SEPARATOR = " "; // 句子间连接符

export function chunkDocument(source: string, text: string): Chunk[] {
  const chunks: Chunk[] = [];
  let current = "";
  let idx = 0;

  // 将缓冲区内容落盘为一个分块
  const flush = (buffer: string): void => {
    chunks.push(makeChunk(source, buffer.trim(), idx++));
  };

  for (const para of text.split(PARAGRAPH_SPLIT)) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // 缓冲区再加一个段落会超出目标长度时，先落盘已有内容
    if (
      current &&
      current.length + trimmed.length + PARAGRAPH_SEPARATOR.length > TARGET_CHARS
    ) {
      flush(current);
      current = "";
    }

    if (trimmed.length > TARGET_CHARS) {
      // 超长段落：先落盘缓冲区，再按句子切分
      if (current) {
        flush(current);
        current = "";
      }

      const sentences = trimmed.split(SENTENCE_SPLIT);
      let sentBuf = "";
      for (const sent of sentences) {
        if (
          sentBuf &&
          sentBuf.length + sent.length + SENTENCE_SEPARATOR.length > TARGET_CHARS
        ) {
          flush(sentBuf);
          sentBuf = "";
        }
        sentBuf += (sentBuf ? SENTENCE_SEPARATOR : "") + sent;
      }

      if (sentBuf.trim()) {
        current += sentBuf.trim();
      }
    } else {
      current += (current ? PARAGRAPH_SEPARATOR : "") + trimmed;
    }
  }

  if (current.trim()) {
    flush(current);
  }

  return chunks;
}

function makeChunk(source: string, text: string, index: number): Chunk {
  return {
    id: `${source}#${index}`,
    text,
    source,
    index,
    tokenEstimate: Math.ceil(text.length / CHARS_PER_TOKEN),
  };
}
