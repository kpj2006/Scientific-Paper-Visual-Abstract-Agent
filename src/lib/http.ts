interface HttpRequestOptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

function isRetriableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function requestWithRetry(url: string, init?: RequestInit, options?: HttpRequestOptions): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? 15000;
  const maxRetries = options?.maxRetries ?? 0;
  const retryDelayMs = options?.retryDelayMs ?? 300;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const signal = init?.signal ?? AbortSignal.timeout(timeoutMs);
      const response = await fetch(url, { ...init, signal });

      if (!response.ok && isRetriableStatus(response.status) && attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 2 ** attempt));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * 2 ** attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Request failed for ${url}`);
}

export async function fetchText(url: string, init?: RequestInit, options?: HttpRequestOptions): Promise<string> {
  const response = await requestWithRetry(url, init, options);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

export async function fetchJson<T>(url: string, init?: RequestInit, options?: HttpRequestOptions): Promise<T> {
  const response = await requestWithRetry(url, init, options);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}