import type { CompanySeed, LinkStatus, Posting } from '../types.ts';
import { asRecord, asString, BROWSER_UA, fetchJson, mapLimit } from './util.ts';

/**
 * Link verification. Every posting shown in the app must have a link that resolved on the latest pull.
 *
 * Rules (first match wins):
 *   network failure, timeout                     -> 'error'   (not shown)
 *   HTTP 404 / 410                               -> 'dead'
 *   HTTP 401 / 403 / 406 / 429 (employer site or CDN blocks bots)
 *        -> ask the ATS itself (opts.confirmLive): live -> 'ok', gone -> 'dead', unknown -> 'error'
 *   any other HTTP >= 400 (incl. 5xx)            -> 'error'
 *   final URL carries `error=true`               -> 'dead'    (Greenhouse closed job -> board with ?error=true)
 *   final URL lacks the job id                   -> 'dead'    (Greenhouse closed job -> redirected elsewhere)
 *   Ashby page body says `"posting":null`        -> 'dead'    (Ashby answers 200 for closed ids)
 *   otherwise                                    -> 'ok'
 *
 * Only 'ok' is ever shown. 'dead' and 'error' postings are dropped from the live snapshot.
 */

export type LinkVerdict = Exclude<LinkStatus, 'unchecked'>;

export interface VerifyOptions {
  /** Parallel requests. Default 8. */
  concurrency?: number;
  /** Parallel requests to any one host (be polite to job-boards.greenhouse.io). Default 4. */
  perHost?: number;
  /** Per-request timeout. Default 10000. */
  timeoutMs?: number;
  /** Extra attempts after a network failure, timeout or 5xx before giving up as 'error'. Default 2. */
  retries?: number;
  /** Delay before retry n is retryDelayMs * n. Default 500. */
  retryDelayMs?: number;
  /** Clock for linkVerifiedAt (Date or ISO string). Default: now. */
  now?: Date | string;
  /**
   * Ask the ATS whether the posting is still open: true = open, false = gone, null = could not tell.
   * Used when the employer's own site blocks bots (401/403/429) and, with `confirmCustomDomains`, for
   * Greenhouse postings that live on an employer domain (where a closed job may keep its gh_jid in the URL).
   */
  confirmLive?: (posting: Posting) => Promise<boolean | null>;
  /** Also run `confirmLive` for ok-looking Greenhouse links on employer domains. Default false. */
  confirmCustomDomains?: boolean;
}

/** Answers employer sites and CDN WAFs give to scripts (CloudFront alternates 403 and 406, others 429). */
const BOT_BLOCK_STATUSES: ReadonlySet<number> = new Set([401, 403, 406, 429]);

const isGreenhouseHost = (host: string): boolean => /(^|\.)greenhouse\.io$/i.test(host);

function parseUrl(u: string): URL | null {
  try {
    return new URL(u);
  } catch {
    return null;
  }
}

/** Pure URL rule: does the page we landed on still look like this job? Exported for tests. */
export function finalUrlLooksClosed(posting: Posting, finalUrl: string): boolean {
  const fin = parseUrl(finalUrl);
  if (!fin) return false;
  if (fin.searchParams.get('error') === 'true') return true;
  return !`${fin.pathname}${fin.search}`.includes(posting.externalId);
}

async function disposeBody(res: Response): Promise<void> {
  try {
    await res.body?.cancel();
  } catch {
    /* body already consumed or locked: nothing to release */
  }
}

/** Verify one posting's apply link. Never throws. */
export async function checkLink(posting: Posting, fetchImpl: typeof fetch, opts: VerifyOptions = {}): Promise<LinkVerdict> {
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const retries = opts.retries ?? 2;
  const delay = opts.retryDelayMs ?? 500;
  let res: Response | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      if (res) await disposeBody(res);
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
    try {
      res = await fetchImpl(posting.applyUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'user-agent': BROWSER_UA,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      res = null;
      continue;
    }
    if (res.status < 500) break; // transient trouble (network, timeout, 5xx) is worth another try; anything else is an answer
  }
  if (!res) return 'error';

  try {
    const status = res.status;
    if (status === 404 || status === 410) return 'dead';
    if (BOT_BLOCK_STATUSES.has(status)) {
      if (!opts.confirmLive) return 'error';
      const live = await opts.confirmLive(posting).catch(() => null);
      return live === true ? 'ok' : live === false ? 'dead' : 'error';
    }
    if (status >= 400) return 'error';

    const finalUrl = res.url || posting.applyUrl;
    if (finalUrlLooksClosed(posting, finalUrl)) return 'dead';

    if (posting.source === 'ashby') {
      let body = '';
      try {
        body = await res.text();
      } catch {
        return 'error';
      }
      if (/"posting"\s*:\s*null/.test(body)) return 'dead';
    }

    if (opts.confirmCustomDomains && opts.confirmLive && posting.source === 'greenhouse') {
      const host = parseUrl(finalUrl)?.hostname ?? '';
      if (!isGreenhouseHost(host)) {
        const live = await opts.confirmLive(posting).catch(() => null);
        if (live === false) return 'dead';
      }
    }
    return 'ok';
  } finally {
    await disposeBody(res);
  }
}

/** Caps in-flight work per key (here: per hostname) without ordering guarantees beyond FIFO. */
function makeKeyedGate(max: number): <T>(key: string, fn: () => Promise<T>) => Promise<T> {
  const active = new Map<string, number>();
  const waiting = new Map<string, (() => void)[]>();
  const release = (key: string): void => {
    const next = waiting.get(key)?.shift();
    if (next) next();
    else active.set(key, (active.get(key) ?? 1) - 1);
  };
  return async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    if ((active.get(key) ?? 0) >= max) {
      await new Promise<void>((resolve) => {
        const q = waiting.get(key) ?? [];
        q.push(resolve);
        waiting.set(key, q);
      });
    } else {
      active.set(key, (active.get(key) ?? 0) + 1);
    }
    try {
      return await fn();
    } finally {
      release(key);
    }
  };
}

/**
 * Verify every posting's link. Sets `linkStatus` and `linkVerifiedAt` ON THE POSTING OBJECTS (in place)
 * and returns the same array for convenience. At most `concurrency` requests overall and `perHost` per host.
 */
export async function verifyLinks(postings: Posting[], fetchImpl: typeof fetch, opts: VerifyOptions = {}): Promise<Posting[]> {
  const now = opts.now instanceof Date ? opts.now.toISOString() : (opts.now ?? new Date().toISOString());
  const gate = makeKeyedGate(opts.perHost ?? 4);
  await mapLimit(postings, opts.concurrency ?? 8, async (p) => {
    p.linkStatus = await gate(parseUrl(p.applyUrl)?.hostname ?? '', () => checkLink(p, fetchImpl, opts));
    p.linkVerifiedAt = now;
  });
  return postings;
}

/** Light listing URL per source: just enough to learn which job ids are open right now. */
function listingUrl(seed: CompanySeed): string {
  const t = encodeURIComponent(seed.token);
  if (seed.source === 'greenhouse') return `https://boards-api.greenhouse.io/v1/boards/${t}/jobs`;
  if (seed.source === 'lever') return `https://api.lever.co/v0/postings/${t}?mode=json`;
  return `https://api.ashbyhq.com/posting-api/job-board/${t}`;
}

function listedIds(seed: CompanySeed, json: unknown): Set<string> | null {
  const rows = seed.source === 'lever' ? json : asRecord(json)?.jobs;
  if (!Array.isArray(rows)) return null;
  const ids = new Set<string>();
  for (const row of rows) {
    const id = asString(asRecord(row)?.id);
    if (id) ids.add(id);
  }
  return ids;
}

export interface ConfirmLiveOptions {
  timeoutMs?: number;
  /** Job ids already known to be open per company slug (for example from the pull that just ran): no request needed. */
  known?: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * Build the `confirmLive` hook from the seed list: ask the ATS itself whether a posting is still open.
 * One listing request per company (memoised), not one per posting, so it stays cheap and polite even when an
 * employer site blocks bots for hundreds of links. true = listed, false = the board no longer lists it,
 * null = could not tell (unknown company, board unreachable).
 */
export function atsConfirmLive(
  seeds: readonly CompanySeed[],
  fetchImpl: typeof fetch,
  opts: ConfirmLiveOptions = {},
): (posting: Posting) => Promise<boolean | null> {
  const bySlug = new Map(seeds.map((s) => [s.slug, s]));
  const cache = new Map<string, Promise<ReadonlySet<string> | null>>();
  const idsFor = (seed: CompanySeed): Promise<ReadonlySet<string> | null> => {
    const known = opts.known?.get(seed.slug);
    if (known) return Promise.resolve(known);
    let pending = cache.get(seed.slug);
    if (!pending) {
      pending = fetchJson(fetchImpl, listingUrl(seed), { timeoutMs: opts.timeoutMs ?? 60_000 }).then(
        (json) => listedIds(seed, json),
        () => null,
      );
      cache.set(seed.slug, pending);
    }
    return pending;
  };
  return async (posting) => {
    const seed = bySlug.get(posting.companySlug);
    if (!seed || seed.source !== posting.source) return null;
    const ids = await idsFor(seed);
    return ids ? ids.has(posting.externalId) : null;
  };
}

/**
 * A live Greenhouse job whose employer-site page is broken (for example the company's website lost its
 * Greenhouse embed) still has a working page on Greenhouse itself, which is also the employer's own ATS posting
 * page. For 'dead' Greenhouse links on employer domains, try that hosted page and, when it resolves and
 * the board API still lists the job, switch `applyUrl` to it and mark the link 'ok'. Mutates in place.
 */
export async function rescueWithHostedUrl(
  postings: Posting[],
  seeds: readonly CompanySeed[],
  fetchImpl: typeof fetch,
  opts: VerifyOptions = {},
): Promise<number> {
  const bySlug = new Map(seeds.map((s) => [s.slug, s]));
  const candidates = postings.filter((p) => {
    if (p.linkStatus !== 'dead' || p.source !== 'greenhouse') return false;
    return !isGreenhouseHost(parseUrl(p.applyUrl)?.hostname ?? '');
  });
  let rescued = 0;
  await mapLimit(candidates, opts.concurrency ?? 8, async (p) => {
    const seed = bySlug.get(p.companySlug);
    if (!seed || seed.source !== 'greenhouse') return;
    if (opts.confirmLive && (await opts.confirmLive(p).catch(() => null)) !== true) return;
    const hosted = { ...p, applyUrl: `https://job-boards.greenhouse.io/${encodeURIComponent(seed.token)}/jobs/${encodeURIComponent(p.externalId)}` };
    if ((await checkLink(hosted, fetchImpl, opts)) === 'ok') {
      p.applyUrl = hosted.applyUrl;
      p.linkStatus = 'ok';
      rescued += 1;
    }
  });
  return rescued;
}
