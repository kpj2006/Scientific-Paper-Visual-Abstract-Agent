export type PaperTier = "tier1" | "tier2" | "tier3";

export interface PaperRecord {
  id: number;
  arxivId: string;
  title: string;
  authors: string[];
  abstract: string;
  publishedAt: string;
  categories: string[];
}

export interface PaperContext {
  tier: PaperTier;
  text: string;
  wordCount: number;
}

export interface ProcessedArtifacts {
  summary: string;
  keyFindings: string[];
  visualScript: string;
  imageUrl: string;
  videoUrl: string;
  socialContent: string;
  embedding: number[];
}

export interface UsageEvent {
  service: "chat" | "embeddings" | "image" | "video";
  requestCount: number;
  paymentAmount: number;
  txHash: string;
  metadata?: Record<string, unknown>;
}

export interface SapTool {
  toolId: string;
  name: string;
  description: string;
  endpoint: string;
  raw: Record<string, unknown>;
}
