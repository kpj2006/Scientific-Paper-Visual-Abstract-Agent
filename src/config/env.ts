import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ARXIV_QUERY: z.string().default("cat:cs.AI"),
  ARXIV_LOOKBACK_DAYS: z.coerce.number().int().positive().default(7),
  AR5IV_BASE_URL: z.string().url().default("https://ar5iv.labs.arxiv.org"),
  ACE_BASE_URL: z.string().url().default("https://platform.acedata.cloud"),
  ACE_API_KEY: z.string().optional().default(""),
  ACE_PAYMENT_NETWORK: z.string().default("solana"),
  ACE_PAYMENT_FACILITATOR: z.string().url().default("https://facilitator.acedata.cloud"),
  OOBE_API_KEY: z.string().optional().default(""),
  SYNAPSE_RPC_URL: z.string().optional().default(""),
  SYNAPSE_GATEWAY_URL: z.string().url().default("https://synapse.oobeprotocol.ai"),
  SYNAPSE_SENTINEL_URL: z.string().optional().default(""),
  SYNAPSE_KEYPAIR_PATH: z.string().default("./keys/agent.json"),
  SYNAPSE_NETWORK: z.enum(["mainnet", "devnet", "testnet"]).default("mainnet"),
  SYNAPSE_REGION: z.enum(["US", "EU"]).default("US"),
  SYNAPSE_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  SYNAPSE_RPC_MAX_RETRIES: z.coerce.number().int().positive().default(3),
  SYNAPSE_CLUSTER: z.string().default("mainnet-beta"),
  PIPELINE_CRON: z.string().default("*/30 * * * *"),
  MAX_PAPERS_PER_RUN: z.coerce.number().int().positive().default(10),
  PAPER_PROCESSING_MODE: z.enum(["abstract", "results", "full"]).default("abstract")
});

export type AppEnv = z.infer<typeof envSchema>;

export const env: AppEnv = envSchema.parse(process.env);