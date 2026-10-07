import type { ModelMessage } from "ai";
import type { ToolRegistry } from "../tools/registry.js";
import type {
  PromptBuilder,
  PromptContext,
} from "../context/prompt-builder.js";
import type { UsageTracker } from "../usage/tracker.js";
import type { SessionStore } from "../session/store.js";
import type { MemoryStore } from "../memory/store.js";

export interface CommandContext {
  messages: ModelMessage[];
  timestamps: Map<number, number>;
  registry: ToolRegistry;
  builder: PromptBuilder;
  tracker: UsageTracker;
  sessionStore: SessionStore;
  model: any; // 模型实例（mock 模型未严格实现 LanguageModel 结构，保持 any）
  makePromptCtx: () => PromptContext;
  ask: () => void;
  memoryStore?: MemoryStore;
  // 扩展逃逸口：允许注入 vectorStore 等额外依赖（见 rag.ts 的 ctx.vectorStore）
  [key: string]: any;
}

export type CommandHandler = (
  cmd: string,
  ctx: CommandContext,
) => boolean | "async";

export function createDispatcher(handlers: CommandHandler[]): CommandHandler {
  return (cmd, ctx) => {
    for (const h of handlers) {
      const result = h(cmd, ctx);
      if (result) return result;
    }
    return false;
  };
}
