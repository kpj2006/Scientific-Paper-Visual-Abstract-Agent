import { migrate, pool } from "./db.js";
import { logger } from "./lib/logger.js";
import { paperQueue } from "./queue/paper-queue.js";
import { runSchedulerCycle } from "./runner/scheduler-cycle.js";
import { startScheduler } from "./scheduler.js";
import { startWorker } from "./worker.js";

async function bootstrap(): Promise<void> {
  await migrate();

  const mode = process.argv[2] ?? "dev";

  if (mode === "scheduler") {
    startScheduler();
    return;
  }

  if (mode === "worker") {
    startWorker();
    return;
  }

  if (mode === "once") {
    const enqueued = await runSchedulerCycle();
    logger.info({ enqueued }, "One-off cycle finished");
    return;
  }

  startScheduler();
  startWorker();
}

bootstrap()
  .catch((error) => {
    logger.error({ error }, "Fatal startup error");
    process.exitCode = 1;
  })
  .finally(async () => {
    if (["once"].includes(process.argv[2] ?? "")) {
      await Promise.allSettled([paperQueue.close(), pool.end()]);
    }
  });
