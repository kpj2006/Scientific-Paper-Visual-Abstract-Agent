import { fetchNewArxivEntries } from "../arxiv/client.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { enqueuePaperJob } from "../queue/paper-queue.js";
import { SapGatewayClient } from "../sap/client.js";
import { upsertPaper, upsertSapTools } from "../store/papers.js";

export async function runSchedulerCycle(): Promise<number> {
  const sap = new SapGatewayClient();
  await sap.registerAgent();
  const tools = await sap.discoverTools();
  await upsertSapTools(tools);

  const entries = await fetchNewArxivEntries(env.MAX_PAPERS_PER_RUN);
  let enqueued = 0;

  for (const entry of entries) {
    const paper = await upsertPaper({
      arxivId: entry.id,
      title: entry.title,
      authors: entry.authors,
      abstract: entry.abstract,
      publishedAt: entry.publishedAt,
      categories: entry.categories
    });

    if (!paper) {
      continue;
    }

    await enqueuePaperJob(paper.id);
    enqueued += 1;
  }

  logger.info({ fetched: entries.length, enqueued, discoveredSapTools: tools.length }, "Scheduler cycle completed");
  return enqueued;
}
