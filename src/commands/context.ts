import type { CommandHandler } from "./index.js";
import {
  buildContextSnapshot,
  renderUsageView,
  renderContextView,
} from "../context/view.js";

export const contextCommands: CommandHandler[] = [
  (cmd, ctx) => {
    if (cmd !== "/context" && cmd !== "context") return false;

    const systemPrompt = ctx.builder.build(ctx.makePromptCtx());
    const memoryChars = ctx.memoryStore?.buildPromptSection().length ?? 0;
    const hasApiKey = Boolean(process.env.DASHSCOPE_API_KEY);
    const toolDescriptionChars = ctx.registry
      .getActiveTools()
      .reduce(
        (total, tool) =>
          total +
          tool.name.length +
          (tool.description?.length ?? 0) +
          JSON.stringify(tool.parameters || {}).length,
        0,
      );

    const snapshot = buildContextSnapshot({
      modelName: hasApiKey ? "Qwen Plus" : "Mock Model (开发用)",
      modelId: hasApiKey ? "qwen3-6-plus" : "mock-model",
      windowTokens: 1_000_000,
      systemPromptChars: systemPrompt.length,
      toolDescriptionChars,
      memoryChars,
      skillsChars: 0,
      messages: ctx.messages,
    });
    console.log(renderContextView(snapshot));
    return true;
  },
  (cmd, ctx) => {
    if (cmd !== "/usage" && cmd !== "usage") return false;
    console.log(renderUsageView(ctx.tracker));
    return true;
  },
];
