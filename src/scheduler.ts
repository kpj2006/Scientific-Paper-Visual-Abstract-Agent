import cron from "node-cron";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { runSchedulerCycle } from "./runner/scheduler-cycle.js";

export function startScheduler(): void {
  cron.schedule(env.PIPELINE_CRON, async () => {
    try {
      await runSchedulerCycle();
    } catch (error) {
      logger.error({ error }, "Scheduler cycle failed");
    }
  });

  logger.info({ cron: env.PIPELINE_CRON }, "Scheduler started");
}
