import crypto from "node:crypto";
import { env } from "../config/env.js";
import { fetchJson } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import type { UsageEvent } from "../types.js";

interface SettledPayment {
  amount: number;
  txHash: string;
}

function deterministicVector(seed: string, length = 16): number[] {
  const bytes = crypto.createHash("sha256").update(seed).digest();
  return Array.from({ length }, (_, index) => bytes[index % bytes.length]! / 255);
}

export class AceWorkflowClient {
  private readonly usageEvents: UsageEvent[] = [];

  private async settleX402(service: UsageEvent["service"], units = 1): Promise<SettledPayment> {
    const estimatedAmount = Number((units * 0.001).toFixed(6));

    try {
      const payload = await fetchJson<{ txHash?: string; amount?: number }>(`${env.ACE_PAYMENT_FACILITATOR}/settle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-network": env.ACE_PAYMENT_NETWORK
        },
        body: JSON.stringify({ service, units })
      });

      return {
        amount: Number(payload.amount ?? estimatedAmount),
        txHash: payload.txHash ?? `sim-${crypto.randomUUID()}`
      };
    } catch {
      return {
        amount: estimatedAmount,
        txHash: `sim-${crypto.randomUUID()}`
      };
    }
  }

  private headers(): HeadersInit {
    return {
      "Content-Type": "application/json",
      ...(env.ACE_API_KEY ? { Authorization: "Bearer " + env.ACE_API_KEY } : {})
    };
  }

  private trackUsage(event: UsageEvent): void {
    this.usageEvents.push(event);
  }

  drainUsageEvents(): UsageEvent[] {
    const events = [...this.usageEvents];
    this.usageEvents.length = 0;
    return events;
  }

  async summarizePaper(context: string): Promise<{ summary: string; keyFindings: string[]; visualScript: string }> {
    let summary = `Summary:\n${context.slice(0, 700)}`;
    let keyFindings = ["Primary finding extracted from abstract.", "Method impact and practical significance."];
    let visualScript = "Open with problem statement, show method, close with key result and implication.";

    if (env.ACE_API_KEY) {
      try {
        const response = await fetchJson<{
          summary?: string;
          keyFindings?: string[];
          visualScript?: string;
        }>(`${env.ACE_BASE_URL}/v1/chat/summarize`, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({ input: context })
        });

        summary = response.summary ?? summary;
        keyFindings = response.keyFindings ?? keyFindings;
        visualScript = response.visualScript ?? visualScript;
      } catch (error) {
        logger.warn({ error }, "Ace chat request failed; using local fallback summary");
      }
    }

    const payment = await this.settleX402("chat");
    this.trackUsage({ service: "chat", requestCount: 1, paymentAmount: payment.amount, txHash: payment.txHash });

    return { summary, keyFindings, visualScript };
  }

  async createEmbedding(text: string): Promise<number[]> {
    let vector = deterministicVector(text, 32);

    if (env.ACE_API_KEY) {
      try {
        const response = await fetchJson<{ embedding?: number[] }>(`${env.ACE_BASE_URL}/v1/embeddings`, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({ input: text })
        });

        if (Array.isArray(response.embedding) && response.embedding.length > 0) {
          vector = response.embedding;
        }
      } catch (error) {
        logger.warn({ error }, "Ace embedding request failed; using deterministic fallback");
      }
    }

    const payment = await this.settleX402("embeddings");
    this.trackUsage({ service: "embeddings", requestCount: 1, paymentAmount: payment.amount, txHash: payment.txHash });
    return vector;
  }

  async generateImage(prompt: string): Promise<string> {
    let imageUrl = `https://dummyimage.com/1024x1024/111827/ffffff&text=${encodeURIComponent("Visual Abstract")}`;

    if (env.ACE_API_KEY) {
      try {
        const response = await fetchJson<{ url?: string }>(`${env.ACE_BASE_URL}/v1/images/generations`, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({ model: "flux", prompt })
        });

        imageUrl = response.url ?? imageUrl;
      } catch (error) {
        logger.warn({ error }, "Ace image generation failed; using fallback image URL");
      }
    }

    const payment = await this.settleX402("image");
    this.trackUsage({ service: "image", requestCount: 1, paymentAmount: payment.amount, txHash: payment.txHash, metadata: { model: "flux" } });
    return imageUrl;
  }

  async generateVideo(script: string): Promise<string> {
    let videoUrl = `https://example.com/videos/${encodeURIComponent(crypto.randomUUID())}`;

    if (env.ACE_API_KEY) {
      try {
        const response = await fetchJson<{ url?: string }>(`${env.ACE_BASE_URL}/v1/videos/generations`, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({ model: "luma", script })
        });

        videoUrl = response.url ?? videoUrl;
      } catch (error) {
        logger.warn({ error }, "Ace video generation failed; using fallback video URL");
      }
    }

    const payment = await this.settleX402("video");
    this.trackUsage({ service: "video", requestCount: 1, paymentAmount: payment.amount, txHash: payment.txHash, metadata: { model: "luma" } });
    return videoUrl;
  }

  buildSocialContent(title: string, findings: string[]): string {
    const bullets = findings.map((finding) => `• ${finding}`).join("\n");
    return `New paper insight: ${title}\n${bullets}\n#arxiv #research #ai`;
  }
}
