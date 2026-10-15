/**
 * Generic HTTP provider: POSTs {task, input} as JSON to FIFTEEN_MODEL_ENDPOINT and
 * expects the same result shape the mock returns. Any failure returns null so the
 * caller keeps its rules result (rules first, model second).
 */
import type { ModelProvider } from './index.ts';

export function httpProvider(endpoint: string, fetchImpl: typeof fetch = fetch): ModelProvider {
  async function call<T>(task: string, input: unknown): Promise<T | null> {
    try {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task, input }),
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }
  return {
    name: 'http',
    classifyRole: (input) => call('classify-role', input),
    classifyEmail: (email) => call('classify-email', email),
    extractProfile: (text, nowIso) => call('extract-profile', { text, nowIso }),
  };
}
