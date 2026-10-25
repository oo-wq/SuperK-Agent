import { Cron } from "croner";
import type { ScheduleType } from "./types.js";

export interface ParsedSchedule {
  type: ScheduleType;
  intervalMs?: number; // interval 类型：固定间隔毫秒数
  cronInstance?: Cron; // cron 类型：croner 实例，负责计算下次执行时间
  onceAt?: Date; // once 类型：一次性执行的目标时间
}

// 匹配 "every 5s" / "every 10min" / "every 2hour" 等固定间隔写法
const INTERVAL_RE = /^every\s+(\d+)\s*(s|sec|m|min|h|hour)s?$/i;
// 形如 2024-01-01 的 ISO 日期前缀
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
// 各时间单位对应的毫秒数
const SECOND_MS = 1000;
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
// cron 无法计算下次执行时间时的兜底间隔（60 秒）
const FALLBACK_INTERVAL_MS = 60_000;

export function parseSchedule(expr: string): ParsedSchedule {
  // 固定间隔
  const intervalMatch = expr.match(INTERVAL_RE);
  if (intervalMatch) {
    const value = parseInt(intervalMatch[1], 10);
    const unit = intervalMatch[2].toLowerCase();
    const multiplier = unit.startsWith("h")
      ? HOUR_MS
      : unit.startsWith("m")
        ? MINUTE_MS
        : SECOND_MS;
    return { type: "interval", intervalMs: value * multiplier };
  }

  // ISO 时间戳
  if (ISO_DATE_RE.test(expr)) {
    const date = new Date(expr);
    if (!isNaN(date.getTime())) {
      return { type: "once", onceAt: date };
    }
  }

  // Cron 表达式
  const cronInstance = new Cron(expr);
  return { type: "cron", cronInstance };
}

export function getNextCronTime(cron: Cron): number {
  return cron.msToNext() ?? FALLBACK_INTERVAL_MS;
}
