import { z } from "zod";

export const ModelConfigSchema = z.object({
  provider: z.enum(["dashscope", "openai", "custom"]).default("dashscope"),
  name: z.string().default("qwen3.7-plus"),
  baseURL: z
    .string()
    .default("https://dashscope.aliyuncs.com/compatible-mode/v1"),
  apiKey: z.string().default(""),
});

export const PluginConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.any()).default({}),
});

export const AgentConfigSchema = z.object({
  maxSpawnDepth: z.number().min(0).max(5).default(1),
  maxConcurrent: z.number().min(1).max(10).default(3),
  defaultTimeout: z.number().default(600000),
});

export const SecurityConfigSchema = z.object({
  defaultRole: z.string().default("developer"),
  auditLog: z.boolean().default(true),
  bashTimestamp: z.boolean().default(true),
});

export const MemoryConfigSchema = z.object({
  dataDir: z.string().default("."),
});

export const RagConfigSchema = z.object({
  enabled: z.boolean().default(true),
  docsDir: z.string().default("docs"),
});

export const CronConfigSchema = z.object({
  enabled: z.boolean().default(true),
  dataDir: z.string().default("."),
});

export const SessionConfigSchema = z.object({
  id: z.string().default("default"),
});

export const UsageConfigSchema = z.object({
  trackingFile: z.string().default(".usage/today.jsonl"),
});

export const SuperKAgentConfigSchema = z.object({
  version: z.string().default("1.0"),
  model: ModelConfigSchema.default(ModelConfigSchema.parse({})),
  plugins: z.array(PluginConfigSchema).default([]),
  agents: AgentConfigSchema.default(AgentConfigSchema.parse({})),
  security: SecurityConfigSchema.default(SecurityConfigSchema.parse({})),
  memory: MemoryConfigSchema.default(MemoryConfigSchema.parse({})),
  rag: RagConfigSchema.default(RagConfigSchema.parse({})),
  cron: CronConfigSchema.default(CronConfigSchema.parse({})),
  session: SessionConfigSchema.default(SessionConfigSchema.parse({})),
  usage: UsageConfigSchema.default(UsageConfigSchema.parse({})),
});

export type SuperKAgentConfig = z.infer<typeof SuperKAgentConfigSchema>;
