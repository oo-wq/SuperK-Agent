import { createInterface } from "node:readline";
import fs from "node:fs";
import { CONFIG_FILE } from "./loader.js";

// DashScope API Key 环境变量名（提示、回退占位符、.env 写入共用）
const DASHSCOPE_API_KEY_ENV = "DASHSCOPE_API_KEY";
// 环境变量文件名
const ENV_FILE = ".env";
// 默认模型名（菜单序号无匹配时回退）
const DEFAULT_MODEL_NAME = "qwen3.7-plus";
// 默认最大并发数
const DEFAULT_MAX_CONCURRENT = 3;
// 菜单序号 → 模型名
const MODEL_OPTIONS: Record<string, string> = {
  "1": "qwen3.7-plus",
  "2": "qwen-turbo-latest",
  "3": "qwen-max-latest",
};

export async function runInit() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => {
      console.log(q);
      rl.question("  > ", resolve);
    });

  console.log("\n  SuperK-Agent 初始化向导\n");

  if (fs.existsSync(CONFIG_FILE)) {
    const overwrite = await ask(`  ${CONFIG_FILE} 已存在，覆盖? (y/N): `);
    if (overwrite.toLowerCase() !== "y") {
      console.log("  已取消\n");
      rl.close();
      return;
    }
  }

  console.log("  选择模型:\n");
  console.log("    1. qwen3.7-plus   (推荐，均衡)");
  console.log("    2. qwen-turbo-latest  (快速，便宜)");
  console.log("    3. qwen-max-latest    (最强，贵)\n");
  const modelChoice = (await ask("  模型 [1]: ")) || "1";
  const modelName = MODEL_OPTIONS[modelChoice] || DEFAULT_MODEL_NAME;

  const apiKey = await ask(
    `\n  DashScope API Key (留空则从环境变量 ${DASHSCOPE_API_KEY_ENV} 读取): `,
  );

  const concurrentStr = await ask("\n  子 Agent 最大并发数 [3]: ");
  const maxConcurrent = parseInt(concurrentStr, 10) || DEFAULT_MAX_CONCURRENT;

  const config = {
    version: "1.0",
    model: {
      provider: "dashscope",
      name: modelName,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: apiKey || `\${${DASHSCOPE_API_KEY_ENV}}`,
    },
    plugins: [{ name: "supabase", enabled: false, config: {} }],
    channels: {},
    agents: { maxSpawnDepth: 1, maxConcurrent, defaultTimeout: 60000 },
    security: { defaultRole: "developer", auditLog: true, bashTimestamp: true },
    memory: { dataDir: "." },
    rag: { enabled: true, docsDir: "docs" },
    cron: { enabled: true, dataDir: "." },
    session: { id: "default" },
    usage: { trackingFile: ".usage/today.jsonl" },
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
  console.log(`\n  ✓ ${CONFIG_FILE} 已生成`);

  const envLines: string[] = [];
  if (apiKey) envLines.push(`${DASHSCOPE_API_KEY_ENV}=${apiKey}`);
  if (envLines.length > 0) {
    fs.writeFileSync(ENV_FILE, envLines.join("\n") + "\n");
    console.log(`  ✓ ${ENV_FILE} 已生成`);
  }

  console.log("\n  启动 Agent: pnpm start\n");
  rl.close();
}
