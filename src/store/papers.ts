import { pool } from "../db.js";
import type { PaperContext, PaperRecord, ProcessedArtifacts, SapTool, UsageEvent } from "../types.js";

interface PaperInput {
  arxivId: string;
  title: string;
  authors: string[];
  abstract: string;
  publishedAt: Date;
  categories: string[];
}

export async function upsertPaper(input: PaperInput): Promise<PaperRecord | null> {
  const result = await pool.query(
    `
      INSERT INTO papers (arxiv_id, title, authors, abstract, published_at, categories)
      VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb)
      ON CONFLICT (arxiv_id) DO NOTHING
      RETURNING id, arxiv_id, title, authors, abstract, published_at, categories
    `,
    [input.arxivId, input.title, JSON.stringify(input.authors), input.abstract, input.publishedAt, JSON.stringify(input.categories)]
  );

  if (result.rowCount === 0) {
    return null;
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

  return {
    id: row.id,
    arxivId: row.arxiv_id,
    title: row.title,
    authors: row.authors,
    abstract: row.abstract,
    publishedAt: row.published_at,
    categories: row.categories
  };
}

export async function markPaperStatus(paperId: number, status: "queued" | "processing" | "completed" | "failed"): Promise<void> {
  await pool.query("UPDATE papers SET status = $1, updated_at = NOW() WHERE id = $2", [status, paperId]);
}

export async function savePaperContext(paperId: number, context: PaperContext): Promise<void> {
  await pool.query(
    `INSERT INTO paper_contexts (paper_id, tier, context_text, word_count) VALUES ($1, $2, $3, $4)`,
    [paperId, context.tier, context.text, context.wordCount]
  );
}

export async function saveArtifacts(paperId: number, artifacts: ProcessedArtifacts): Promise<void> {
  await pool.query(
    `
      INSERT INTO paper_outputs (paper_id, summary, key_findings, visual_script, image_url, video_url, social_content, embedding)
      VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8::jsonb)
    `,
    [
      paperId,
      artifacts.summary,
      JSON.stringify(artifacts.keyFindings),
      artifacts.visualScript,
      artifacts.imageUrl,
      artifacts.videoUrl,
      artifacts.socialContent,
      JSON.stringify(artifacts.embedding)
    ]
  );
}

export async function saveUsageEvents(paperId: number, events: UsageEvent[]): Promise<void> {
  for (const event of events) {
    await pool.query(
      `
        INSERT INTO service_usage (paper_id, service, request_count, payment_amount, tx_hash, metadata)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [paperId, event.service, event.requestCount, event.paymentAmount, event.txHash, JSON.stringify(event.metadata ?? {})]
    );
  }
}

export async function fetchRecentEmbeddings(limit = 25): Promise<number[][]> {
  const result = await pool.query(
    `
      SELECT embedding
      FROM paper_outputs
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );

  return result.rows
    .map((row) => row.embedding as unknown)
    .filter((embedding): embedding is number[] => Array.isArray(embedding));
}

export async function upsertSapTools(tools: SapTool[]): Promise<void> {
  for (const tool of tools) {
    await pool.query(
      `
        INSERT INTO sap_tools (tool_id, name, description, endpoint, raw, last_seen_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
        ON CONFLICT (tool_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          endpoint = EXCLUDED.endpoint,
          raw = EXCLUDED.raw,
          last_seen_at = NOW()
      `,
      [tool.toolId, tool.name, tool.description, tool.endpoint, JSON.stringify(tool.raw)]
    );
  }
}
