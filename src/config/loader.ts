import fs from "node:fs";
import { SuperKAgentConfigSchema, type SuperKAgentConfig } from "./schema.js";

export const CONFIG_FILE = "superk-agent.config.json";

// 匹配 "${VAR_NAME}" 形式的环境变量占位符
const ENV_VAR_RE = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

// 替换单个字符串中的环境变量占位符；未设置时保留原值并告警
function substituteString(value: string): string {
  return value.replace(ENV_VAR_RE, (fullMatch, name: string) => {
    const val = process.env[name];
    if (val === undefined) {
      console.warn(`  ⚠ 环境变量 ${name} 未设置，保留原值`);
      return fullMatch;
    }
    return val;
  });
}

// 递归遍历配置对象，替换所有字符串字段中的环境变量占位符
function substituteEnvVars(obj: unknown): unknown {
  if (typeof obj === "string") return substituteString(obj);
  if (Array.isArray(obj)) return obj.map(substituteEnvVars);
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = substituteEnvVars(value);
    }
    return result;
  }
  return obj;
}

export function loadConfig(path = CONFIG_FILE): SuperKAgentConfig {
  if (!fs.existsSync(path)) {
    console.log(`  未找到 ${path}，使用默认配置`);
    console.log("  运行 pnpm run init 生成配置文件\n");
    return SuperKAgentConfigSchema.parse({});
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(path, "utf-8"));
  } catch (err) {
    console.error(`  ✗ 解析 ${path} 失败: ${(err as Error).message}`);
    process.exit(1);
  }

  const substituted = substituteEnvVars(raw);

  const result = SuperKAgentConfigSchema.safeParse(substituted);
  if (!result.success) {
    console.error("  ✗ 配置文件校验失败:");
    for (const issue of result.error.issues) {
      console.error(`    ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(`  ✓ 已加载 ${path}`);
  return result.data;
}
