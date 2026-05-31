import { Queue, Worker } from "bullmq";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { processPaper } from "../pipeline/process-paper.js";
import { pool } from "../db.js";

const connection = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null as null
};

export const PAPER_QUEUE_NAME = "paper-processing";

export const paperQueue = new Queue<{ paperId: number }, void, "process-paper">(PAPER_QUEUE_NAME, { connection });

export async function enqueuePaperJob(paperId: number): Promise<void> {
  await paperQueue.add("process-paper", { paperId }, { removeOnComplete: 200, removeOnFail: 200 });
}

export function startPaperWorker(): Worker<{ paperId: number }, void, "process-paper"> {
  const worker = new Worker<{ paperId: number }, void, "process-paper">(
    PAPER_QUEUE_NAME,
    async (job) => {
      const result = await pool.query(
        `
          SELECT id, arxiv_id, title, authors, abstract, published_at, categories
          FROM papers
          WHERE id = $1
        `,
        [job.data.paperId]
      );

      if (result.rowCount === 0) {
        logger.warn({ paperId: job.data.paperId }, "Skipping job because paper was not found");
        return;
      }

      const row = result.rows[0] as {
        id: number;
        arxiv_id: string;
        title: string;
        authors: string[];
        abstract: string;
        published_at: string;
        categories: string[];
      };

      await processPaper({
        id: row.id,
        arxivId: row.arxiv_id,
        title: row.title,
        authors: row.authors,
        abstract: row.abstract,
        publishedAt: row.published_at,
        categories: row.categories
      });
    },
    { connection, concurrency: 2 }
  );

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, error }, "Paper worker job failed");
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id }, "Paper worker job completed");
  });

  return worker;
}
