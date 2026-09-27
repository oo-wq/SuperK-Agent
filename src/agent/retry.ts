// 可重试的 HTTP 状态码（408 超时、429 限流、529 过载）
const RETRYABLE_STATUS_CODES = new Set([408, 429, 529]);

// 网络 / 流式错误特征字符串，命中即重试
const NETWORK_ERROR_HINTS = [
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "timeout",
  "fetch failed",
  "network",
  // AI SDK 会把流式错误包装成 NoOutputGeneratedError
  "No output generated",
] as const;

// 判断是否值得重试
export function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message || "";

  // HTTP 状态码判断
  const statusMatch = message.match(/(\d{3})/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    if (RETRYABLE_STATUS_CODES.has(status)) return true;
    if (status >= 500 && status < 600) return true; // 服务器错误（LLM 侧问题）
    if (status >= 400 && status < 500) return false; // 客户端错误
  }

  // 网络错误
  if (NETWORK_ERROR_HINTS.some((hint) => message.includes(hint))) {
    return true;
  }

  return false;
}

// 指数退避 + 随机抖动
export function calculateDelay(
  attempt: number,
  baseMs = 500,
  maxMs = 30000,
): number {
  const exponential = baseMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exponential, maxMs);
  const jitterRange = capped * 0.25; // 抖动幅度 ±25%
  const jittered = capped + (Math.random() * 2 - 1) * jitterRange;
  return Math.max(0, Math.round(jittered));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
