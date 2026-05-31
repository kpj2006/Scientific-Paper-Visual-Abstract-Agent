import crypto from "node:crypto";
import { env } from "../config/env.js";
import { fetchJson, fetchText } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import type { SapTool } from "../types.js";
import { createSynapseClient, getSynapseRpcEndpoint } from "./synapse.js";

export class SapGatewayClient {
  private buildGatewayUrl(pathname: string): string {
    return new URL(pathname, env.SYNAPSE_GATEWAY_URL).toString();
  }

  private toSapTool(record: Record<string, unknown>): SapTool {
    return {
      toolId: String(record.id ?? record.toolId ?? record.name ?? "unknown"),
      name: String(record.name ?? "unknown"),
      description: String(record.description ?? ""),
      endpoint: String(record.endpoint ?? record.url ?? env.SYNAPSE_GATEWAY_URL),
      raw: record
    };
  }

  private parseSkillsMarkdown(markdown: string): SapTool[] {
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
    const tools: SapTool[] = [];
    const seen = new Set<string>();
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(markdown)) !== null) {
      const label = match[1];
      const url = match[2];
      if (!label || !url || seen.has(url)) {
        continue;
      }

      seen.add(url);
      const labelSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
      const urlHash = crypto.createHash("sha256").update(url).digest("hex").slice(0, 12);
      const toolId = `skills-${labelSlug || "doc"}-${urlHash}`;
      tools.push({
        toolId,
        name: label.trim(),
        description: "Discovered from Synapse SAP skills reference",
        endpoint: url,
        raw: { source: "skills.md", label, url }
      });
    }

    return tools;
  }

  private async discoverGatewayTools(): Promise<SapTool[]> {
    const endpoints = ["/api/tools", "/tools", "/v1/tools"];

    for (const endpoint of endpoints) {
      try {
        const payload = await fetchJson<{ tools?: Array<Record<string, unknown>> }>(this.buildGatewayUrl(endpoint), undefined, {
          timeoutMs: env.SYNAPSE_RPC_TIMEOUT_MS,
          maxRetries: env.SYNAPSE_RPC_MAX_RETRIES
        });
        const tools = (payload.tools ?? []).map((tool) => this.toSapTool(tool));

        if (tools.length > 0) {
          return tools;
        }
      } catch {
        // Try next endpoint shape.
      }
    }

    return [];
  }

  private async discoverSkillsTools(): Promise<SapTool[]> {
    try {
      const markdown = await fetchText(this.buildGatewayUrl("/skills.md"), undefined, {
        timeoutMs: env.SYNAPSE_RPC_TIMEOUT_MS,
        maxRetries: env.SYNAPSE_RPC_MAX_RETRIES
      });
      return this.parseSkillsMarkdown(markdown);
    } catch {
      return [];
    }
  }

  async registerAgent(): Promise<void> {
    const synapse = createSynapseClient();
    const rpcEndpoint = getSynapseRpcEndpoint();

    try {
      const [health, version] = await Promise.all([synapse.rpc.getHealth(), synapse.rpc.getVersion()]);
      logger.info(
        {
          endpoint: rpcEndpoint,
          health,
          version
        },
        "Synapse RPC connectivity verified"
      );
    } catch (error) {
      logger.warn({ error, endpoint: rpcEndpoint }, "Synapse RPC health check failed; continuing with gateway discovery");
    }

    try {
      const sdk = (await import("@oobe-protocol-labs/synapse-sap-sdk")) as Record<string, unknown>;
      const createSapClient = sdk.createSapClient as ((rpcUrl: string) => unknown) | undefined;

      if (createSapClient) {
        const sapClient = createSapClient(rpcEndpoint);
        logger.info({ sapClientInitialized: Boolean(sapClient) }, "SAP SDK runtime client created");
      }

      logger.info(
        {
          sdkExports: Object.keys(sdk),
          cluster: env.SYNAPSE_CLUSTER,
          rpcUrl: rpcEndpoint
        },
        "SAP SDK detected; runtime registration client initialized"
      );
    } catch (error) {
      logger.warn({ error }, "SAP SDK unavailable at runtime; continuing with gateway discovery");
    }
  }

  async discoverTools(): Promise<SapTool[]> {
    const [gatewayTools, skillsTools] = await Promise.all([this.discoverGatewayTools(), this.discoverSkillsTools()]);
    const discoveredTools = [...gatewayTools, ...skillsTools];
    const byKey = new Map<string, SapTool>();

    for (const tool of discoveredTools) {
      const key = `${tool.toolId}:${tool.endpoint}`;
      if (!byKey.has(key)) {
        byKey.set(key, tool);
      }
    }

    const tools = [...byKey.values()];
    if (tools.length === 0) {
      logger.warn("No SAP gateway endpoint or skills markdown returned tools; continuing with empty registry");
    }
    return tools;
  }
}
