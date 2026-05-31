import { SynapseClient, SynapseNetwork, SynapseRegion, resolveEndpoint } from "@oobe-protocol-labs/synapse-client-sdk";
import { env } from "../config/env.js";

function appendApiKey(endpoint: string, apiKey: string): string {
  const url = new URL(endpoint);
  if (!url.searchParams.get("api_key")) {
    url.searchParams.set("api_key", apiKey);
  }
  return url.toString();
}

export function getSynapseRpcEndpoint(): string {
  const resolvedEndpoint =
    env.SYNAPSE_RPC_URL ||
    resolveEndpoint(env.SYNAPSE_NETWORK as SynapseNetwork, env.SYNAPSE_REGION as SynapseRegion).rpc;

  return env.OOBE_API_KEY ? appendApiKey(resolvedEndpoint, env.OOBE_API_KEY) : resolvedEndpoint;
}

export function createSynapseClient(): SynapseClient {
  return new SynapseClient({
    endpoint: getSynapseRpcEndpoint(),
    timeout: env.SYNAPSE_RPC_TIMEOUT_MS,
    maxRetries: env.SYNAPSE_RPC_MAX_RETRIES
  });
}
