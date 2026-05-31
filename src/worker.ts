import { logger } from "./lib/logger.js";
import { startPaperWorker } from "./queue/paper-queue.js";

export function startWorker(): void {
  startPaperWorker();
  logger.info("Worker started");
}
