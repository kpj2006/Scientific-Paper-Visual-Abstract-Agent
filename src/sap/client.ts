import { env } from "../config/env.js";
import { fetchJson } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import type { SapTool } from "../types.js";

export class SapGatewayClient {
  async registerAgent(): Promise<void> {
    try {
      const sdk = (await import("@oobe-protocol-labs/synapse-sap-sdk")) as Record<string, unknown>;
      logger.info(
        {
          sdkExports: Object.keys(sdk),
          cluster: env.SYNAPSE_CLUSTER,
          rpcUrl: env.SYNAPSE_RPC_URL || "default"
        },
        "SAP SDK detected; runtime registration hook available"
      );
    } catch (error) {
      logger.warn({ error }, "SAP SDK unavailable at runtime; continuing with gateway discovery");
    }
  }

  async discoverTools(): Promise<SapTool[]> {
    const endpoints = ["/api/tools", "/tools", "/v1/tools"];

    for (const endpoint of endpoints) {
      try {
        const payload = await fetchJson<{ tools?: Array<Record<string, unknown>> }>(`${env.SYNAPSE_GATEWAY_URL}${endpoint}`);
        const tools = (payload.tools ?? []).map((tool) => ({
          toolId: String(tool.id ?? tool.toolId ?? tool.name ?? "unknown"),
          name: String(tool.name ?? "unknown"),
          description: String(tool.description ?? ""),
          endpoint: String(tool.endpoint ?? tool.url ?? env.SYNAPSE_GATEWAY_URL),
          raw: tool
        }));

        if (tools.length > 0) {
          return tools;
        }
      } catch {
        // Try next endpoint shape.
      }
    }

    logger.warn("No SAP tool list endpoint returned data; continuing with empty registry");
    return [];
  }
}
