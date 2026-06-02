import { migrate, pool } from "./db.js";
import { logger } from "./lib/logger.js";
import { paperQueue, startPaperWorker } from "./queue/paper-queue.js";
import { runSchedulerCycle } from "./runner/scheduler-cycle.js";
import { startScheduler } from "./scheduler.js";
import { startWorker } from "./worker.js";

async function waitForQueueDrain(pollIntervalMs = 2000, timeoutMs = 300000): Promise<void> {
  const start = Date.now();
  let stableCount = 0;
  let lastActive = -1;

  while (Date.now() - start < timeoutMs) {
    const counts = await paperQueue.getJobCounts();
    
    // Done when no work is pending or in progress
    if (counts.waiting === 0 && counts.active === 0 && counts.delayed === 0) {
      logger.info({ completed: counts.completed, failed: counts.failed }, "Queue drained");
      return;
    }
    
    // Detect stuck jobs: if active count hasn't changed for 30 seconds, something's wrong
    if (counts.active === lastActive && counts.active > 0) {
      stableCount += pollIntervalMs;
      if (stableCount > 30000) {
        logger.warn({ active: counts.active, stableFor: stableCount }, "Active jobs appear stuck, moving on");
        return;
      }
    } else {
      stableCount = 0;
      lastActive = counts.active;
    }
    
    logger.info(
      { waiting: counts.waiting, active: counts.active, failed: counts.failed, completed: counts.completed },
      "Waiting for queue to drain..."
    );
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  logger.warn("Queue drain timeout reached");
}

async function bootstrap(): Promise<void> {
  await migrate();

  const runMode = process.argv[2] ?? "dev";

  if (runMode === "scheduler") {
    startScheduler();
    return;
  }

  if (runMode === "worker") {
    startWorker();
    return;
  }

  if (runMode === "once") {
    const enqueued = await runSchedulerCycle();
    if (enqueued > 0) {
      logger.info({ enqueued }, "Papers enqueued, starting worker to process...");
      const worker = startPaperWorker();
      await waitForQueueDrain();
      await worker.close();
      logger.info({ enqueued }, "One-off cycle finished (papers processed)");
    } else {
      logger.info({ enqueued }, "One-off cycle finished (no new papers to process)");
    }
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
