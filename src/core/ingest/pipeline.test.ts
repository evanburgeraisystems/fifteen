import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CompanySeed, HistoryFile, Snapshot } from '../types.ts';
import { OFFLINE_SEEDS, createFixtureFetch, responseWithUrl } from './offline.ts';
import { runPipeline } from './pipeline.ts';
import { fetchJson, HttpError, mapLimit } from './util.ts';
import { validateSeeds } from './seeds.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'fifteen-pipeline-test-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const NOW = new Date('2026-10-15T11:00:00.000Z');
const readJson = async <T>(rel: string): Promise<T> => JSON.parse(await readFile(path.join(dir, rel), 'utf8')) as T;

/** Fixture fetch that makes one host misbehave. */
function withFailure(host: string, respond: () => Response | Promise<Response>): typeof fetch {
  const base = createFixtureFetch();
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (new URL(url).hostname === host) return Promise.resolve(respond());
    return base(input, init);
  }) as typeof fetch;
}

describe('runPipeline (offline fixtures, no network)', () => {
  it('pulls all three sources, keeps only internships, verifies links and writes every file', async () => {
    const res = await runPipeline({ seeds: OFFLINE_SEEDS, dataDir: dir, fetchImpl: createFixtureFetch(), now: NOW });
    expect(res.wrote).toBe(true);
    expect(res.outcomes.map((o) => [o.seed.slug, o.ok, o.fetched])).toEqual([
      ['coinbase', true, 5],
      ['belvederetrading', true, 6],
      ['ramp', true, 5],
    ]);
    const snap = await readJson<Snapshot>('snapshots/latest.json');
    expect(snap.dataset).toBe('live');
    expect(snap.date).toBe('2026-10-15');
    expect(snap.trackingSince).toBe('2026-10-15');
    expect(snap.postings.length).toBeGreaterThanOrEqual(5);
    expect(snap.postings.every((p) => p.isInternship && p.linkStatus === 'ok' && p.linkVerifiedAt === NOW.toISOString())).toBe(true);
    expect(snap.postings.every((p) => p.lastSeen === '2026-10-15' && p.firstSeen === '2026-10-15')).toBe(true);
    expect(snap.sources.map((s) => s.companySlug)).toEqual(['coinbase', 'belvederetrading', 'ramp']);
    expect(snap.sources.every((s) => s.ok && s.error === null)).toBe(true);
    expect(await readJson('index.json')).toEqual({ dates: ['2026-10-15'], latest: '2026-10-15' });
    const history = await readJson<HistoryFile>('history.json');
    expect(history.roles.length).toBeGreaterThan(0);
    expect(history.trackingSince).toBe('2026-10-15');
  });

  it('keeps firstSeen across days and extends history', async () => {
    await runPipeline({ seeds: OFFLINE_SEEDS, dataDir: dir, fetchImpl: createFixtureFetch(), now: NOW });
    const day2 = new Date('2026-10-16T11:00:00.000Z');
    await runPipeline({ seeds: OFFLINE_SEEDS, dataDir: dir, fetchImpl: createFixtureFetch(), now: day2 });
    const snap = await readJson<Snapshot>('snapshots/latest.json');
    expect(snap.date).toBe('2026-10-16');
    expect(snap.trackingSince).toBe('2026-10-15');
    expect(snap.postings.every((p) => p.firstSeen === '2026-10-15' && p.lastSeen === '2026-10-16')).toBe(true);
    expect(await readJson('index.json')).toEqual({ dates: ['2026-10-15', '2026-10-16'], latest: '2026-10-16' });
    const history = await readJson<HistoryFile>('history.json');
    expect(history.volume.filter((v) => v.date === '2026-10-16').every((v) => v.opened === 0)).toBe(true);
  });

  it('isolates a failing board: the run continues and the failure is recorded', async () => {
    const res = await runPipeline({
      seeds: OFFLINE_SEEDS,
      dataDir: dir,
      fetchImpl: withFailure('api.lever.co', () => new Response('nope', { status: 404 })),
      now: NOW,
    });
    expect(res.wrote).toBe(true);
    const lever = res.outcomes.find((o) => o.seed.slug === 'belvederetrading');
    expect(lever).toMatchObject({ ok: false, fetched: 0 });
    expect(lever?.error).toMatch(/404/);
    const snap = await readJson<Snapshot>('snapshots/latest.json');
    expect(snap.sources.find((s) => s.companySlug === 'belvederetrading')).toMatchObject({ ok: false, kept: 0 });
    expect(snap.postings.some((p) => p.source === 'greenhouse')).toBe(true);
    expect(snap.postings.some((p) => p.source === 'lever')).toBe(false);
  });

  it('carries yesterday\'s postings for a board that fails today (re-verified, not "closed")', async () => {
    await runPipeline({ seeds: OFFLINE_SEEDS, dataDir: dir, fetchImpl: createFixtureFetch(), now: NOW });
    const day2 = new Date('2026-10-16T11:00:00.000Z');
    const res = await runPipeline({
      seeds: OFFLINE_SEEDS,
      dataDir: dir,
      fetchImpl: withFailure('api.ashbyhq.com', () => new Response('down', { status: 503 })),
      now: day2,
      concurrency: 1,
    });
    const ramp = res.outcomes.find((o) => o.seed.slug === 'ramp');
    expect(ramp?.ok).toBe(false);
    expect(ramp?.carried).toBe(2);
    const snap = await readJson<Snapshot>('snapshots/latest.json');
    const carried = snap.postings.filter((p) => p.companySlug === 'ramp');
    expect(carried).toHaveLength(2);
    expect(carried.every((p) => p.lastSeen === '2026-10-15' && p.linkVerifiedAt === day2.toISOString())).toBe(true);
    expect(snap.sources.find((s) => s.companySlug === 'ramp')?.error).toMatch(/2 postings carried from 2026-10-15/);
  }, 20_000);

  it('records dead links in sources[] and keeps them out of the snapshot', async () => {
    const base = createFixtureFetch();
    const fake = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('jobs.lever.co/belvederetrading/cbde47db')) return Promise.resolve(responseWithUrl('', { status: 404 }, url));
      return base(input, init);
    }) as typeof fetch;
    const res = await runPipeline({ seeds: OFFLINE_SEEDS, dataDir: dir, fetchImpl: fake, now: NOW });
    expect(res.linkCounts.dead).toBe(1);
    const snap = await readJson<Snapshot>('snapshots/latest.json');
    expect(snap.postings.find((p) => p.externalId.startsWith('cbde47db'))).toBeUndefined();
    const lever = snap.sources.find((s) => s.companySlug === 'belvederetrading');
    expect(lever?.kept).toBe(1);
    expect(lever?.error).toBe('1 dead link dropped');
    expect(lever?.ok).toBe(true);
  });

  it('swaps a broken employer-site Greenhouse link for the Greenhouse-hosted page', async () => {
    const base = createFixtureFetch();
    const fake = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith('https://www.coinbase.com/careers/positions/8173991')) return Promise.resolve(responseWithUrl('', { status: 404 }, url));
      return base(input, init);
    }) as typeof fetch;
    const res = await runPipeline({ seeds: OFFLINE_SEEDS, dataDir: dir, fetchImpl: fake, now: NOW });
    expect(res.linkCounts.dead).toBe(0);
    const snap = await readJson<Snapshot>('snapshots/latest.json');
    expect(snap.postings.find((p) => p.externalId === '8173991')?.applyUrl).toBe('https://job-boards.greenhouse.io/coinbase/jobs/8173991');
    expect(snap.sources.find((s) => s.companySlug === 'coinbase')?.error).toBeNull();
  });

  it('writes nothing when every board fails', async () => {
    const dead = (() => Promise.resolve(new Response('x', { status: 404 }))) as unknown as typeof fetch;
    const res = await runPipeline({ seeds: OFFLINE_SEEDS, dataDir: dir, fetchImpl: dead, now: NOW });
    expect(res.wrote).toBe(false);
    await expect(readFile(path.join(dir, 'snapshots', 'latest.json'), 'utf8')).rejects.toThrow();
  });

  it('does not write on a dry run', async () => {
    const res = await runPipeline({ seeds: OFFLINE_SEEDS, dataDir: dir, fetchImpl: createFixtureFetch(), now: NOW, write: false });
    expect(res.wrote).toBe(false);
    expect(res.snapshot.postings.length).toBeGreaterThan(0);
  });
});

describe('seed validation', () => {
  const ok: CompanySeed = { slug: 'acme', name: 'Acme', source: 'greenhouse', token: 'acme', industry: 'finance' };
  it('accepts a good seed file', () => {
    expect(validateSeeds([ok, { ...ok, slug: 'beta', careersUrl: 'https://x.com' }])).toHaveLength(2);
  });
  it('rejects duplicates, unknown sources and unknown industries', () => {
    expect(() => validateSeeds([ok, ok])).toThrow(/duplicate slug/);
    expect(() => validateSeeds([{ ...ok, source: 'workday' }])).toThrow(/source must be/);
    expect(() => validateSeeds([{ ...ok, industry: 'crypto' }])).toThrow(/unknown industry/);
    expect(() => validateSeeds([{ ...ok, token: '' }])).toThrow(/missing token/);
    expect(() => validateSeeds({})).toThrow(/array/);
  });
});

describe('network helpers', () => {
  it('fetchJson retries 5xx then succeeds', async () => {
    let calls = 0;
    const fake = (() => {
      calls += 1;
      return Promise.resolve(calls < 3 ? new Response('x', { status: 503 }) : new Response('{"a":1}', { status: 200 }));
    }) as unknown as typeof fetch;
    expect(await fetchJson(fake, 'https://x.test', { baseDelayMs: 0 })).toEqual({ a: 1 });
    expect(calls).toBe(3);
  });
  it('fetchJson gives up after the retries and reports the last error', async () => {
    const fake = (() => Promise.resolve(new Response('x', { status: 502 }))) as unknown as typeof fetch;
    await expect(fetchJson(fake, 'https://x.test', { retries: 1, baseDelayMs: 0 })).rejects.toBeInstanceOf(HttpError);
  });
  it('fetchJson does not retry a 404', async () => {
    let calls = 0;
    const fake = (() => {
      calls += 1;
      return Promise.resolve(new Response('x', { status: 404 }));
    }) as unknown as typeof fetch;
    await expect(fetchJson(fake, 'https://x.test', { baseDelayMs: 0 })).rejects.toThrow(/404/);
    expect(calls).toBe(1);
  });
  it('mapLimit keeps order and honours the limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 3));
      inFlight -= 1;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
