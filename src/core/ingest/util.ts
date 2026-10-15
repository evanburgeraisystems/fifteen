/**
 * Small, dependency-free helpers shared by the ingest adapters and the pipeline.
 * Pure TypeScript with erasable syntax only (Node 24 type stripping).
 */
import type { Compensation } from '../types.ts';

// ---------- defensive JSON narrowing (we never trust a third-party response shape) ----------

export type Rec = Record<string, unknown>;

export function asRecord(v: unknown): Rec | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Rec) : null;
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function asString(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

export function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

// ---------- text ----------

const NAMED_ENTITIES: Record<string, string> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * Decode HTML entities exactly ONE level. Greenhouse's `content` field is HTML that was
 * entity-escaped once (`&lt;p&gt;Tom &amp;amp; Jerry&lt;/p&gt;`); one pass yields real HTML whose
 * own entities (`&amp;`) are still intact for the HTML-to-text step to handle.
 */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const cp = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : whole;
    }
    if (body.startsWith('#')) {
      const cp = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** Minimal HTML escape, used to wrap plain text before it joins an HTML description. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Any date-ish input -> ISO date-time, or null when unparseable. */
export function toIso(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/** Unique, trimmed, non-empty strings, case-insensitive, first spelling wins. */
export function uniqueStrings(values: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const t = (v ?? '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export const hasRemoteWord = (locations: string[]): boolean => locations.some((l) => /\bremote\b/i.test(l));

// ---------- compensation ----------

export type PayUnit = Compensation['unit'];

const money = (n: number, currency: string): string => {
  const sym = currency === 'USD' ? '$' : `${currency} `;
  return `${sym}${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

/** Build a `source: 'field'` compensation from numbers the ATS handed us. */
export function fieldCompensation(
  min: number | null,
  max: number | null,
  unit: PayUnit,
  currency: string,
  label: string | null,
): Compensation | null {
  if (min === null && max === null) return null;
  const lo = min ?? max;
  const hi = max ?? min;
  if (lo === null || hi === null) return null;
  const range = lo === hi ? money(lo, currency) : `${money(lo, currency)} - ${money(hi, currency)}`;
  const raw = `${range} per ${unit}${label ? ` (${label})` : ''}`;
  return { min: lo, max: hi, unit, currency, source: 'field', raw };
}

// ---------- network ----------

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

export interface FetchJsonOptions {
  /** Extra attempts after the first for network errors, 429 and 5xx. Default 2. */
  retries?: number;
  /** Delay before retry n is baseDelayMs * n. Default 600. */
  baseDelayMs?: number;
  timeoutMs?: number;
}

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** GET a JSON document. Throws HttpError for non-2xx; retries transient failures. */
export async function fetchJson(fetchImpl: typeof fetch, url: string, opts: FetchJsonOptions = {}): Promise<unknown> {
  const retries = opts.retries ?? 2;
  const base = opts.baseDelayMs ?? 600;
  const timeoutMs = opts.timeoutMs ?? 90_000;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(base * attempt);
    try {
      const res = await fetchImpl(url, {
        headers: { accept: 'application/json', 'user-agent': BROWSER_UA },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new HttpError(res.status, url);
        continue;
      }
      if (!res.ok) throw new HttpError(res.status, url);
      return (await res.json()) as unknown;
    } catch (e) {
      if (e instanceof HttpError) throw e;
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Run `fn` over `items` with at most `limit` in flight; results keep input order. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T, i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
