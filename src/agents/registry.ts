/**
 * 一个简单的注册表
 * 记录谁在跑
 * 跑到哪里了
 * 结果是什么
 */

import { DEFAULT_CONFIG } from "./types";
import type { SubAgentConfig, SubAgentRun } from "./types";

export class SubAgentRegistry {
  private runs = new Map<string, SubAgentRun>();
  private config: SubAgentConfig = DEFAULT_CONFIG;
  private idCounter = 0;

  constructor(config?: Partial<SubAgentConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  generateId(): string {
    return `sub-${++this.idCounter}-${Date.now().toString(36).slice(-4)}`;
  }

  canSpawn(currentDepth: number): { ok: boolean; reason?: string } {
    if (currentDepth >= this.config.maxSpawnDepth) {
      return {
        ok: false,
        reason: `已达到最大嵌套深度 ${this.config.maxSpawnDepth}`,
      };
    }
    const activeCount = this.getActiveRuns().length;
    if (activeCount >= this.config.maxConcurrent) {
      return {
        ok: false,
        reason: `已达到最大并行子Agent数 ${this.config.maxConcurrent}`,
      };
    }
    return { ok: true };
  }

  register(run: SubAgentRun): void {
    this.runs.set(run.id, run);
  }

  complete(id: string, result: string): void {
    // 强行完成一个子Agent
    this.finish(id, "completed", { result });
  }

  fail(id: string, error: string): void {
    // 强行失败一个子Agent
    this.finish(id, "error", { error });
  }

  // 统一收尾：更新状态与完成时间，并写入结果 / 错误信息
  private finish(
    id: string,
    status: "completed" | "error",
    patch: Partial<Pick<SubAgentRun, "result" | "error">>,
  ): void {
    const run = this.runs.get(id);
    if (!run) return;
    run.status = status;
    run.finishedAt = new Date().toISOString();
    Object.assign(run, patch);
  }

  get(id: string): SubAgentRun | undefined {
    return this.runs.get(id);
  }

  getActiveRuns(): SubAgentRun[] {
    return Array.from(this.runs.values()).filter((r) => r.status === "running");
  }

  getAllRuns(): SubAgentRun[] {
    return Array.from(this.runs.values());
  }

  getConfig(): SubAgentConfig {
    return this.config;
  }
}
