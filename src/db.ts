import { Pool } from "pg";
import { env } from "./config/env.js";

export const pool = new Pool({ connectionString: env.DATABASE_URL });

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS papers (
      id SERIAL PRIMARY KEY,
      arxiv_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      authors JSONB NOT NULL,
      abstract TEXT NOT NULL,
      published_at TIMESTAMPTZ NOT NULL,
      categories JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS paper_contexts (
      id SERIAL PRIMARY KEY,
      paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      tier TEXT NOT NULL,
      context_text TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS paper_outputs (
      id SERIAL PRIMARY KEY,
      paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      summary TEXT NOT NULL,
      key_findings JSONB NOT NULL,
      visual_script TEXT NOT NULL,
      image_url TEXT NOT NULL,
      video_url TEXT NOT NULL,
      social_content TEXT NOT NULL,
      embedding JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS service_usage (
      id SERIAL PRIMARY KEY,
      paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
      service TEXT NOT NULL,
      request_count INTEGER NOT NULL,
      payment_amount NUMERIC(18, 8) NOT NULL,
      tx_hash TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sap_tools (
      id SERIAL PRIMARY KEY,
      tool_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      raw JSONB NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
