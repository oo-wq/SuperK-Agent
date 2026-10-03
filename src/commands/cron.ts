import type { CommandHandler } from "./index.js";
import type { CronService } from "../cron/service.js";

const CRON_PREFIX = "/cron";

// 任务状态对应的显示图标（未列出的状态统一用 ·）
const JOB_STATUS_ICONS: Record<string, string> = {
  running: "⟳",
  scheduled: "◉",
  disabled: "○",
};

export function createCronCommands(cronService: CronService): CommandHandler[] {
  const handler: CommandHandler = (cmd) => {
    if (!cmd.startsWith(CRON_PREFIX)) return false;
    const sub = cmd.slice(CRON_PREFIX.length).trim();

    if (!sub || sub === "list") {
      const jobs = cronService.list();
      if (jobs.length === 0) {
        console.log("  暂无定时任务");
      } else {
        console.log(`  定时任务 (${jobs.length}):`);
        for (const j of jobs) {
          const icon = JOB_STATUS_ICONS[j.status] ?? "·";
          console.log(
            `    ${icon} ${j.config.id} — ${j.config.name} [${j.config.schedule}] (${j.status})`,
          );
        }
      }
      return true;
    }

    if (sub === "logs") {
      const logs = cronService.getRecentLogs(undefined, 10);
      if (logs.length === 0) {
        console.log("  暂无执行记录");
      } else {
        console.log("  最近执行记录:");
        for (const l of logs) {
          const icon = l.status === "success" ? "✓" : "✗";
          console.log(
            `    ${icon} ${l.jobId} @ ${l.startedAt} — ${l.output?.slice(0, 80) || l.error || ""}`,
          );
        }
      }
      return true;
    }

    console.log("  用法: /cron [list|logs]");
    return true;
  };
  return [handler];
}
