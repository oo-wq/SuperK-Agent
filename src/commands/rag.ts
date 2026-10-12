import type { CommandHandler } from "./index.js";

// 导入命令前缀："ingest <path>" 形式的命令以此开头
const INGEST_PREFIX = "ingest ";
// RAG 导入工具名（与 src/tools/rag-tools.ts 中注册的名称一致）
const RAG_INGEST_TOOL_NAME = "rag_ingest";

export const ragCommands: CommandHandler[] = [
  (cmd, ctx) => {
    if (cmd !== "/rag" && cmd !== "rag") return false;
    const vs = ctx.vectorStore;
    console.log(`\n[知识库] ${vs.size()} 个片段`);
    const sources = vs.sources();
    if (sources.length > 0) console.log(`  来源: ${sources.join(", ")}`);
    console.log("");
    return true;
  },

  (cmd, ctx) => {
    if (!cmd.startsWith(INGEST_PREFIX)) return false;
    const path = cmd.slice(INGEST_PREFIX.length).trim();
    console.log(`\n[导入] 正在处理 ${path}...`);
    const ragIngestTool = ctx.registry
      .getActiveTools()
      .find((t) => t.name === RAG_INGEST_TOOL_NAME)!;
    ragIngestTool.execute({ path }).then((result) => {
      console.log(`  ${result}\n`);
      ctx.ask();
    });
    return "async";
  },
];
