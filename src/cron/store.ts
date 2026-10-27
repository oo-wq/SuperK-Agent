import fs from "node:fs";
import type { CronJobConfig, RunLog } from "./types.js";

// cron 数据目录（相对 baseDir）
const CRON_DIR = ".cron";
const JOBS_FILE = `${CRON_DIR}/jobs.json`;
const LOGS_FILE = `${CRON_DIR}/logs.jsonl`;
// 查询最近日志时默认返回的条数
const DEFAULT_LOG_LIMIT = 10;

// 解析单行 JSONL 日志，损坏行返回 null
function parseLog(line: string): RunLog | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export class CronStore {
  constructor(private baseDir: string = ".") {}

  private get jobsPath() {
    return `${this.baseDir}/${JOBS_FILE}`;
  }
  private get logsPath() {
    return `${this.baseDir}/${LOGS_FILE}`;
  }

  init(): void {
    const dir = `${this.baseDir}/${CRON_DIR}`;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  loadJobs(): CronJobConfig[] {
    if (!fs.existsSync(this.jobsPath)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(this.jobsPath, "utf-8"));
      return data.jobs || [];
    } catch {
      return [];
    }
  }

  saveJobs(jobs: CronJobConfig[]): void {
    this.init();
    fs.writeFileSync(this.jobsPath, JSON.stringify({ jobs }, null, 2));
  }

  appendLog(log: RunLog): void {
    this.init();
    fs.appendFileSync(this.logsPath, JSON.stringify(log) + "\n");
  }

  getRecentLogs(jobId?: string, limit = DEFAULT_LOG_LIMIT): RunLog[] {
    if (!fs.existsSync(this.logsPath)) return [];
    const lines = fs
      .readFileSync(this.logsPath, "utf-8")
      .split("\n")
      .filter(Boolean);

    let logs = lines.map(parseLog).filter((l): l is RunLog => l !== null);

    if (jobId) logs = logs.filter((l) => l.jobId === jobId);
    return logs.slice(-limit);
  }
}
