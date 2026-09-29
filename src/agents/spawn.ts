import { ModelMessage, streamText } from "ai";
import { ToolRegistry } from "../tools/registry";
import { SubAgentRegistry } from "./registry";
import { SpawnRequest } from "./types";

export interface SpawnContext {
  model: any;
  registry: ToolRegistry;
  agentRegistry: SubAgentRegistry;
  buildSystem: () => string;
  currentDepth: number;
}

const EXCLUDED_TOOLS = new Set(["spawn_agent"]); // 不允许子Agent调用spawn_agent工具
const MAX_STEPS = 30; // 子Agent最多循环步数

const AGENT_COLORS = [
  "\x1b[36m", // cyan
  "\x1b[33m", // yellow
  "\x1b[35m", // magenta
  "\x1b[32m", // green
  "\x1b[34m", // blue
];
const RESET = "\x1b[0m";

function agentTag(index: number, runId: string): string {
  const color = AGENT_COLORS[index % AGENT_COLORS.length];
  return `${color}[Agent-${index + 1}:${runId}]${RESET}`;
}

// 取最后一条 assistant 消息的文本内容；找不到或无可提取文本时返回 undefined
function lastAssistantText(
  messages: ModelMessage[],
  joinSep: string,
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    const content = message.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join(joinSep);
    }
    return undefined;
  }
  return undefined;
}

export async function spawnAgent(
  request: SpawnRequest,
  ctx: SpawnContext,
  index = 0,
): Promise<string> {
  const { ok, reason } = ctx.agentRegistry.canSpawn(ctx.currentDepth);
  if (!ok) return `[spawn]拒绝：${reason}`;

  const runId = ctx.agentRegistry.generateId();
  const tag = agentTag(index, runId);
  const run = {
    id: runId,
    task: request.task,
    status: "running" as const,
    depth: ctx.currentDepth + 1,
    startedAt: new Date().toISOString(),
  };
  ctx.agentRegistry.register(run);

  const timeout = request.timeout || 60000;
  const ac = new AbortController(); // 用于取消子Agent的执行
  console.log(`${tag}启动: ${request.task.slice(0, 50)}`);

  // 关键:独立的message
  const messages: ModelMessage[] = [
    {
      role: "user",
      content: request.task,
    },
  ];

  try {
    const system =
      ctx.buildSystem() +
      "\n\n[子 Agent 模式] 你是一个被派出去执行具体任务的子 Agent。直接完成任务并输出结论，保持简洁。" +
      "\n当你需要同时获取多个独立信息时（比如读多个文件、搜多个关键词），尽可能在一次回复中并行调用多个工具，不要一个个串行调用。";

    // 不能跟父Agent共用同一个agentLoop
    const tools = ctx.registry.toAISDKFormatUnlocked(EXCLUDED_TOOLS);
    const timer = setTimeout(() => {
      // 超时取消子Agent
      ac.abort();
    }, timeout);

    try {
      let step = 0;
      while (step < MAX_STEPS) {
        step++;
        const isLastStep = step === MAX_STEPS;
        console.log(
          `  ${tag} Step ${step}/${MAX_STEPS}${isLastStep ? " (总结)" : ""}`,
        );
        if (isLastStep) {
          messages.push({
            role: "user",
            content:
              "你已经收集了足够的信息。请直接输出文字总结，不要再调用任何工具。",
          });
        }
        const result = streamText({
          // 子Agent向LLM发送请求
          model: ctx.model,
          system,
          tools,
          toolChoice: isLastStep ? "none" : "auto",
          messages,
          maxRetries: 0,
          abortSignal: ac.signal,
          providerOptions: { openai: { parallelToolCalls: true } },
          onError: () => {},
        });
        let hasToolCall = false;
        for await (const part of result.fullStream) {
          if (part.type === "tool-call") {
            hasToolCall = true;
            const argsPreview = JSON.stringify(part.input).slice(0, 80);
            console.log(`  ${tag} 调用 ${part.toolName}(${argsPreview})`);
          }
        }
        const response = await result.response;
        messages.push(...response.messages);
        if (!hasToolCall) break;
      }
    } finally {
      clearTimeout(timer);
    }

    // 提取最后一条 assistant 回复
    const result = lastAssistantText(messages, "\n") ?? "(无输出)";

    ctx.agentRegistry.complete(runId, result);
    console.log(`${tag} 完成 ✓ (${result.length})字符`);

    return result;
  } catch (err) {
    const error = err as { name?: string; message?: string };
    const isAbort = error.name === "AbortError" || ac.signal.aborted;
    const errorMsg = isAbort
      ? `执行超时 (${timeout / 1000}s)`
      : error.message || String(err);
    ctx.agentRegistry.fail(runId, errorMsg);
    console.log(`  ${tag} ${isAbort ? "超时" : "失败"} ✗: ${errorMsg}`);
    if (isAbort) {
      const text = lastAssistantText(messages, "");
      if (text) return `[部分结果] ${text}`; // 子Agent执行超时，返回部分结果，避免父Agent等待过久
    }
    return `[sub-agent 执行失败] ${errorMsg}`;
  }
}

export async function spawnParallel(
  requests: SpawnRequest[],
  ctx: SpawnContext,
): Promise<Array<{ task: string; result: string }>> {
  console.log(`\n  ┌─ 派发 ${requests.length} 个子 Agent 并行执行 ─┐`);
  const results = await Promise.all(
    requests.map(async (req, i) => {
      const result = await spawnAgent(req, ctx, i);
      return { task: req.task, result };
    }),
  );
  console.log(`  └─ 全部完成 (${results.length}/${requests.length}) ─┘\n`);
  return results;
}
