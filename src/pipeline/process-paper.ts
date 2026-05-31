import { AceWorkflowClient } from "../ace/client.js";
import { buildPaperContext } from "../arxiv/extractor.js";
import { logger } from "../lib/logger.js";
import {
  fetchRecentEmbeddings,
  markPaperStatus,
  saveArtifacts,
  savePaperContext,
  saveUsageEvents
} from "../store/papers.js";
import type { PaperRecord } from "../types.js";

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  const length = a.length;
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let index = 0; index < length; index += 1) {
    const x = a[index] ?? 0;
    const y = b[index] ?? 0;
    dot += x * y;
    magA += x * x;
    magB += y * y;
  }

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function isNearDuplicate(embedding: number[]): Promise<boolean> {
  const recent = await fetchRecentEmbeddings();
  return recent.some((vector) => cosineSimilarity(embedding, vector) >= 0.97);
}

export async function processPaper(paper: PaperRecord): Promise<void> {
  await markPaperStatus(paper.id, "processing");
  const ace = new AceWorkflowClient();

  try {
    const context = await buildPaperContext(paper.arxivId, paper.abstract);
    await savePaperContext(paper.id, context);

    const embedding = await ace.createEmbedding(`${paper.title}\n${context.text}`);
    if (await isNearDuplicate(embedding)) {
      logger.info({ paperId: paper.id, arxivId: paper.arxivId }, "Skipping near-duplicate paper by embedding similarity");
      await markPaperStatus(paper.id, "completed");
      await saveUsageEvents(paper.id, ace.drainUsageEvents());
      return;
    }

    const chat = await ace.summarizePaper(context.text);
    const imageUrl = await ace.generateImage(`${paper.title}\n${chat.visualScript}`);
    const videoUrl = await ace.generateVideo(chat.visualScript);

    await saveArtifacts(paper.id, {
      summary: chat.summary,
      keyFindings: chat.keyFindings,
      visualScript: chat.visualScript,
      imageUrl,
      videoUrl,
      socialContent: ace.buildSocialContent(paper.title, chat.keyFindings),
      embedding
    });

    await saveUsageEvents(paper.id, ace.drainUsageEvents());
    await markPaperStatus(paper.id, "completed");
    logger.info({ paperId: paper.id, arxivId: paper.arxivId }, "Paper processing completed");
  } catch (error) {
    await markPaperStatus(paper.id, "failed");
    logger.error({ error, paperId: paper.id, arxivId: paper.arxivId }, "Paper processing failed");
    throw error;
  }
}
