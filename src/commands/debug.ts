import { estimateMessageTokens, applyDefense } from "../context/defense.js";
import { textToolResultOutput } from "../context/tool-result-output.js";
import type { CommandHandler } from "./index.js";

// 模拟长对话的参数
const SIM_ROUNDS = 5; // 模拟轮数（每轮 4 条消息，共 20 条）
const SIM_MAX_AGE_MINUTES = 20; // 最早消息的年龄（分钟）
const SIM_AGE_STEP_MINUTES = 4; // 每轮年龄递减的步长（分钟）
const SIM_OUTPUT_REPEAT = 200; // 大工具结果的重复次数

export const debugCommands: CommandHandler[] = [
  (cmd, ctx) => {
    if (cmd !== "模拟长对话" && cmd !== "sim") return false;
    const now = Date.now();
    console.log("\n[模拟] 注入 20 条历史消息（含大量工具结果）...");
    for (let i = 0; i < SIM_ROUNDS; i++) {
      const age =
        (SIM_MAX_AGE_MINUTES - i * SIM_AGE_STEP_MINUTES) * 60 * 1000;
      const idx = ctx.messages.length;
      ctx.messages.push({
        role: "user",
        content: `第 ${i + 1} 轮：帮我读文件 file-${i}.ts`,
      });
      ctx.timestamps.set(idx, now - age);
      ctx.messages.push({
        role: "assistant",
        content: [
          {
            type: "tool-call" as const,
            toolCallId: `sim-${i}`,
            toolName: "read_file",
            input: { path: `file-${i}.ts` },
          },
        ],
      });
      ctx.timestamps.set(idx + 1, now - age);
      const bigContent =
        `// file-${i}.ts\n` +
        "export function handler() {\n  // ...\n}\n".repeat(SIM_OUTPUT_REPEAT);
      ctx.messages.push({
        role: "tool",
        content: [
          {
            type: "tool-result" as const,
            toolCallId: `sim-${i}`,
            toolName: "read_file",
            output: textToolResultOutput(bigContent),
          },
        ],
      });
      ctx.timestamps.set(idx + 2, now - age);
      ctx.messages.push({
        role: "assistant",
        content: [
          { type: "text" as const, text: `文件 file-${i}.ts 的内容已读取。` },
        ],
      });
      ctx.timestamps.set(idx + 3, now - age);
    }
    console.log(
      `[模拟完成] ${ctx.messages.length} 条消息, ~${estimateMessageTokens(ctx.messages)} tokens\n`,
    );
    return true;
  },

  (cmd, ctx) => {
    if (cmd !== "执行防线" && cmd !== "defend") return false;
    console.log("\n--- 执行三层防线 ---");
    const before = estimateMessageTokens(ctx.messages);
    const def = applyDefense(ctx.messages, ctx.timestamps);
    ctx.messages = def.messages;
    console.log(
      `  [Layer 2] 截断: ${def.truncated} 条, 预算清理: ${def.compacted} 条`,
    );
    console.log(
      `  [Layer 3] 软修剪: ${def.softPruned}, 硬清除: ${def.hardPruned}`,
    );
    console.log(
      `  [结果] ~${before} → ~${def.tokenEstimate} tokens (节省 ${before - def.tokenEstimate})\n`,
    );
    return true;
  },

  (cmd, ctx) => {
    if (cmd !== "status" && cmd !== "查看状态") return false;
    const tokens = estimateMessageTokens(ctx.messages);
    const memCount = ctx.memoryStore?.list().length ?? 0;
    console.log(
      `\n[状态] ${ctx.messages.length} 条消息, ~${tokens} tokens, ${memCount} 条记忆\n`,
    );
    return true;
  },
];
