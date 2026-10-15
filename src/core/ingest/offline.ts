import { readFileSync } from 'node:fs';
import type { CompanySeed } from '../types.ts';

/**
 * Offline mode: a `fetch` that serves the recorded fixtures instead of the network. Used by
 * `node scripts/pull.ts --offline` (CI/dev) and by the pipeline tests. Node-only (reads files).
 *
 * Board requests get the recorded board response. Every other URL is treated as a posting page that
 * resolves fine (200, same URL); Ashby pages carry a `"posting":{` marker like the real ones.
 */

const FIXTURE_DIR = new URL('./__fixtures__/', import.meta.url);
const readFixture = (name: string): string => readFileSync(new URL(name, FIXTURE_DIR), 'utf8');

/** The companies the fixtures were recorded from. */
export const OFFLINE_SEEDS: CompanySeed[] = [
  { slug: 'coinbase', name: 'Coinbase', source: 'greenhouse', token: 'coinbase', industry: 'finance' },
  { slug: 'belvederetrading', name: 'Belvedere Trading', source: 'lever', token: 'belvederetrading', industry: 'finance' },
  { slug: 'ramp', name: 'Ramp', source: 'ashby', token: 'ramp', industry: 'finance' },
];

/** A Response whose `.url` is set (the constructor leaves it empty), so redirect logic can be exercised. */
export function responseWithUrl(body: string | null, init: ResponseInit, url: string): Response {
  const res = new Response(body, init);
  Object.defineProperty(res, 'url', { value: url });
  return res;
}

export function createFixtureFetch(): typeof fetch {
  const boards: Record<string, string> = {
    'boards-api.greenhouse.io': readFixture('greenhouse-jobs.json'),
    'api.lever.co': readFixture('lever-postings.json'),
    'api.ashbyhq.com': readFixture('ashby-board.json'),
  };
  const impl = (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(url);
    const board = boards[u.hostname];
    // board listing: .../boards/{t}/jobs, /v0/postings/{slug}, /posting-api/job-board/{org}
    const isListing = board !== undefined && !/\/jobs\/\d+$/.test(u.pathname) && !/\/postings\/[^/]+\/[^/]+$/.test(u.pathname);
    if (board !== undefined && isListing) {
      return Promise.resolve(responseWithUrl(board, { status: 200, headers: { 'content-type': 'application/json' } }, url));
    }
    if (board !== undefined) return Promise.resolve(responseWithUrl('{}', { status: 200 }, url));
    const body = u.hostname.endsWith('ashbyhq.com') ? '<html><script>{"posting":{"id":"x"}}</script></html>' : '<html></html>';
    return Promise.resolve(responseWithUrl(body, { status: 200, headers: { 'content-type': 'text/html' } }, url));
  };
  return impl as typeof fetch;
}
