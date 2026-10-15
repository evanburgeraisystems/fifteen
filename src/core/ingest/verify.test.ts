import { describe, expect, it } from 'vitest';
import type { CompanySeed, Posting } from '../types.ts';
import { responseWithUrl } from './offline.ts';
import { atsConfirmLive, checkLink, finalUrlLooksClosed, rescueWithHostedUrl, verifyLinks } from './verify.ts';

const posting = (over: Partial<Posting> = {}): Posting => ({
  id: 'greenhouse:acme:1234',
  source: 'greenhouse',
  company: 'Acme',
  companySlug: 'acme',
  externalId: '1234',
  title: 'Finance Intern',
  normalizedTitle: 'finance intern',
  department: null,
  locations: [],
  cities: [],
  remote: false,
  postedAt: null,
  updatedAt: null,
  applyUrl: 'https://job-boards.greenhouse.io/acme/jobs/1234',
  description: '',
  compensation: null,
  firstSeen: '2026-10-01',
  lastSeen: '2026-10-15',
  linkVerifiedAt: null,
  linkStatus: 'unchecked',
  isInternship: true,
  eligibility: { gradYears: [], phrases: [], evidence: null },
  classification: { industry: 'finance', career: 'other', family: 'business', method: 'rules', confidence: 0.5, evidence: [] },
  requirements: { required: [], preferred: [], minGpa: null, majors: [] },
  deadline: null,
  cycle: 'summer-2027',
  dedupeKey: 'acme|finance intern|summer-2027',
  ...over,
});

const FAST = { retryDelayMs: 0 };

const reply = (status: number, url: string, body = '<html></html>') => (): Promise<Response> =>
  Promise.resolve(responseWithUrl(body, { status }, url));

const fetchOf = (fn: (url: string) => Promise<Response>): typeof fetch => ((url: string) => fn(url)) as unknown as typeof fetch;

describe('checkLink: HTTP status rules', () => {
  const p = posting();
  it('404 is dead', async () => {
    expect(await checkLink(p, fetchOf(reply(404, p.applyUrl)))).toBe('dead');
  });
  it('410 is dead', async () => {
    expect(await checkLink(p, fetchOf(reply(410, p.applyUrl)))).toBe('dead');
  });
  it('200 on the job page is ok', async () => {
    expect(await checkLink(p, fetchOf(reply(200, p.applyUrl)))).toBe('ok');
  });
  it('5xx is error (not dead)', async () => {
    for (const status of [500, 502, 503]) expect(await checkLink(p, fetchOf(reply(status, p.applyUrl)), FAST)).toBe('error');
  });
  it('retries transient trouble (network failure, 5xx) and recovers', async () => {
    let calls = 0;
    const flaky = fetchOf((url) => {
      calls += 1;
      if (calls === 1) return Promise.reject(new TypeError('fetch failed'));
      if (calls === 2) return reply(503, url)();
      return reply(200, url)();
    });
    expect(await checkLink(p, flaky, FAST)).toBe('ok');
    expect(calls).toBe(3);
  });
  it('gives up after the retries', async () => {
    let calls = 0;
    const down = fetchOf((url) => {
      calls += 1;
      return reply(502, url)();
    });
    expect(await checkLink(p, down, { ...FAST, retries: 1 })).toBe('error');
    expect(calls).toBe(2);
  });
  it('does not retry a definite answer (404, 403)', async () => {
    let calls = 0;
    const gone = fetchOf((url) => {
      calls += 1;
      return reply(404, url)();
    });
    await checkLink(p, gone, FAST);
    expect(calls).toBe(1);
  });
  it('other client errors are error', async () => {
    expect(await checkLink(p, fetchOf(reply(418, p.applyUrl)))).toBe('error');
  });
  it('a network failure is error', async () => {
    const boom = fetchOf(() => Promise.reject(new TypeError('fetch failed')));
    expect(await checkLink(p, boom, FAST)).toBe('error');
  });
  it('a timeout is error', async () => {
    const slow = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('timed out', 'TimeoutError')));
      })) as unknown as typeof fetch;
    expect(await checkLink(p, slow, { ...FAST, timeoutMs: 20 })).toBe('error');
  });
  it('sends a browser-like User-Agent and follows redirects with GET', async () => {
    let seen: RequestInit | undefined;
    const spy = ((_url: string, init?: RequestInit) => {
      seen = init;
      return Promise.resolve(responseWithUrl('', { status: 200 }, p.applyUrl));
    }) as unknown as typeof fetch;
    await checkLink(p, spy);
    expect(seen?.method).toBe('GET');
    expect(seen?.redirect).toBe('follow');
    const ua = new Headers(seen?.headers).get('user-agent') ?? '';
    expect(ua).toMatch(/Mozilla\/5\.0/);
    expect(ua).toMatch(/Chrome/);
  });
});

describe('checkLink: Greenhouse closed-job redirects', () => {
  const p = posting();
  it('a redirect to the board with ?error=true is dead', async () => {
    expect(await checkLink(p, fetchOf(reply(200, 'https://job-boards.greenhouse.io/acme?error=true')))).toBe('dead');
  });
  it('a redirect to a URL lacking the job id is dead', async () => {
    expect(await checkLink(p, fetchOf(reply(200, 'https://job-boards.greenhouse.io/acme')))).toBe('dead');
    expect(await checkLink(p, fetchOf(reply(200, 'https://www.acme.com/careers/search')))).toBe('dead');
  });
  it('a redirect that still carries the job id (employer domain, canonical path) is ok', async () => {
    const q = posting({ applyUrl: 'https://acme.com/jobs/search?gh_jid=1234' });
    expect(await checkLink(q, fetchOf(reply(200, 'https://acme.com/careers/listing/intern/1234?gh_jid=1234')))).toBe('ok');
  });
  it('the exact-URL / http->https normalisation is ok', async () => {
    expect(await checkLink(p, fetchOf(reply(200, 'https://job-boards.greenhouse.io/acme/jobs/1234')))).toBe('ok');
  });
  it('finalUrlLooksClosed is a pure URL rule', () => {
    expect(finalUrlLooksClosed(p, 'https://x.com/acme/jobs/1234?error=true')).toBe(true);
    expect(finalUrlLooksClosed(p, 'https://x.com/acme')).toBe(true);
    expect(finalUrlLooksClosed(p, 'https://x.com/acme/jobs/1234')).toBe(false);
    expect(finalUrlLooksClosed(p, 'not a url')).toBe(false);
  });
});

describe('checkLink: Lever and Ashby', () => {
  const lever = posting({ id: 'lever:acme:abc-123', source: 'lever', externalId: 'abc-123', applyUrl: 'https://jobs.lever.co/acme/abc-123' });
  const ashby = posting({ id: 'ashby:acme:abc-123', source: 'ashby', externalId: 'abc-123', applyUrl: 'https://jobs.ashbyhq.com/acme/abc-123' });

  it('Lever 404 is dead, 200 is ok', async () => {
    expect(await checkLink(lever, fetchOf(reply(404, lever.applyUrl)))).toBe('dead');
    expect(await checkLink(lever, fetchOf(reply(200, lever.applyUrl)))).toBe('ok');
  });
  it('Ashby 404 is dead', async () => {
    expect(await checkLink(ashby, fetchOf(reply(404, ashby.applyUrl)))).toBe('dead');
  });
  it('Ashby answers 200 for a closed id with "posting":null in the page: dead', async () => {
    const closed = reply(200, ashby.applyUrl, '<title>Jobs</title><script>window.__appData = {"posting":null,"organization":{}}</script>');
    expect(await checkLink(ashby, fetchOf(closed))).toBe('dead');
  });
  it('Ashby 200 with a real posting object is ok', async () => {
    const open = reply(200, ashby.applyUrl, '<script>window.__appData = {"posting":{"id":"abc-123","title":"Intern"}}</script>');
    expect(await checkLink(ashby, fetchOf(open))).toBe('ok');
  });
  it('Lever/Ashby redirected to the board root is dead', async () => {
    expect(await checkLink(lever, fetchOf(reply(200, 'https://jobs.lever.co/acme')))).toBe('dead');
    expect(await checkLink(ashby, fetchOf(reply(200, 'https://jobs.ashbyhq.com/acme')))).toBe('dead');
  });
});

describe('checkLink: employer sites that block bots', () => {
  const p = posting({ applyUrl: 'https://www.acme.com/careers/positions/1234?gh_jid=1234' });
  it('403 without a way to ask the ATS is error', async () => {
    expect(await checkLink(p, fetchOf(reply(403, p.applyUrl)))).toBe('error');
  });
  it('403 is settled by the ATS when it can answer', async () => {
    expect(await checkLink(p, fetchOf(reply(403, p.applyUrl)), { confirmLive: () => Promise.resolve(true) })).toBe('ok');
    expect(await checkLink(p, fetchOf(reply(403, p.applyUrl)), { confirmLive: () => Promise.resolve(false) })).toBe('dead');
    expect(await checkLink(p, fetchOf(reply(429, p.applyUrl)), { confirmLive: () => Promise.resolve(null) })).toBe('error');
    expect(await checkLink(p, fetchOf(reply(406, p.applyUrl)), { confirmLive: () => Promise.resolve(true) })).toBe('ok'); // CloudFront WAF
    expect(await checkLink(p, fetchOf(reply(401, p.applyUrl)), { confirmLive: () => Promise.resolve(true) })).toBe('ok');
    expect(await checkLink(p, fetchOf(reply(403, p.applyUrl)), { confirmLive: () => Promise.reject(new Error('x')) })).toBe('error');
  });
  it('an ok-looking Greenhouse link on an employer domain is double-checked only when asked', async () => {
    const ok = reply(200, 'https://www.acme.com/careers/positions/1234?gh_jid=1234');
    const gone = () => Promise.resolve(false);
    expect(await checkLink(p, fetchOf(ok), { confirmLive: gone })).toBe('ok');
    expect(await checkLink(p, fetchOf(ok), { confirmLive: gone, confirmCustomDomains: true })).toBe('dead');
    const hosted = posting();
    expect(await checkLink(hosted, fetchOf(reply(200, hosted.applyUrl)), { confirmLive: gone, confirmCustomDomains: true })).toBe('ok');
  });
});

describe('verifyLinks', () => {
  it('sets linkStatus and linkVerifiedAt on every posting', async () => {
    const live = posting({ id: 'a', externalId: '1', applyUrl: 'https://x.test/jobs/1' });
    const dead = posting({ id: 'b', externalId: '2', applyUrl: 'https://x.test/jobs/2' });
    const flaky = posting({ id: 'c', externalId: '3', applyUrl: 'https://x.test/jobs/3' });
    const fake = fetchOf((url) => {
      if (url.endsWith('/1')) return reply(200, url)();
      if (url.endsWith('/2')) return reply(404, url)();
      return reply(503, url)();
    });
    const now = new Date('2026-10-15T11:00:00.000Z');
    const out = await verifyLinks([live, dead, flaky], fake, { now, retryDelayMs: 0 });
    expect(out.map((p) => p.linkStatus)).toEqual(['ok', 'dead', 'error']);
    expect(out.every((p) => p.linkVerifiedAt === '2026-10-15T11:00:00.000Z')).toBe(true);
    expect(live.linkStatus).toBe('ok'); // in place
  });

  it('caps parallel requests per host', async () => {
    const perHost = new Map<string, number>();
    let peakA = 0;
    const fake = fetchOf(async (url) => {
      const host = new URL(url).hostname;
      const n = (perHost.get(host) ?? 0) + 1;
      perHost.set(host, n);
      if (host === 'a.test') peakA = Math.max(peakA, n);
      await new Promise((r) => setTimeout(r, 5));
      perHost.set(host, n - 1);
      return responseWithUrl('', { status: 200 }, url);
    });
    const many = Array.from({ length: 20 }, (_, i) => posting({ id: `p${i}`, externalId: String(i), applyUrl: `https://a.test/jobs/${i}` }));
    await verifyLinks(many, fake, { concurrency: 8, perHost: 2 });
    expect(peakA).toBeLessThanOrEqual(2);
    expect(many.every((p) => p.linkStatus === 'ok')).toBe(true);
  });

  it('respects the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const fake = fetchOf(async (url) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return responseWithUrl('', { status: 200 }, url);
    });
    const many = Array.from({ length: 25 }, (_, i) => posting({ id: `p${i}`, externalId: String(i), applyUrl: `https://x.test/jobs/${i}` }));
    await verifyLinks(many, fake, { concurrency: 3 });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
    expect(many.every((p) => p.linkStatus === 'ok')).toBe(true);
  });
});

describe('atsConfirmLive', () => {
  const seeds: CompanySeed[] = [
    { slug: 'acme', name: 'Acme', source: 'greenhouse', token: 'acmeboard', industry: 'finance' },
    { slug: 'lev', name: 'Lev', source: 'lever', token: 'levslug', industry: 'finance' },
    { slug: 'ash', name: 'Ash', source: 'ashby', token: 'ashorg', industry: 'finance' },
  ];
  const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });

  it('checks the Greenhouse board listing once per company, however many postings ask', async () => {
    const urls: string[] = [];
    const fake = fetchOf((url) => {
      urls.push(url);
      return Promise.resolve(json({ jobs: [{ id: 1234 }, { id: 99 }] }));
    });
    const confirm = atsConfirmLive(seeds, fake);
    expect(await confirm(posting())).toBe(true);
    expect(await confirm(posting({ externalId: '555' }))).toBe(false);
    expect(await confirm(posting({ externalId: '99' }))).toBe(true);
    expect(urls).toEqual(['https://boards-api.greenhouse.io/v1/boards/acmeboard/jobs']);
  });

  it('reads Lever (array) and Ashby (jobs[]) listings', async () => {
    const urls: string[] = [];
    const fake = fetchOf((url) => {
      urls.push(url);
      return Promise.resolve(url.includes('lever') ? json([{ id: 'uuid-1' }]) : json({ jobs: [{ id: 'uuid-2' }] }));
    });
    const confirm = atsConfirmLive(seeds, fake);
    expect(await confirm(posting({ source: 'lever', companySlug: 'lev', externalId: 'uuid-1' }))).toBe(true);
    expect(await confirm(posting({ source: 'lever', companySlug: 'lev', externalId: 'uuid-9' }))).toBe(false);
    expect(await confirm(posting({ source: 'ashby', companySlug: 'ash', externalId: 'uuid-2' }))).toBe(true);
    expect(urls).toEqual(['https://api.lever.co/v0/postings/levslug?mode=json', 'https://api.ashbyhq.com/posting-api/job-board/ashorg']);
  });

  it('uses ids it already knows without any request', async () => {
    const fake = fetchOf(() => Promise.reject(new Error('should not be called')));
    const confirm = atsConfirmLive(seeds, fake, { known: new Map([['acme', new Set(['1234'])]]) });
    expect(await confirm(posting())).toBe(true);
    expect(await confirm(posting({ externalId: '777' }))).toBe(false);
  });

  it('cannot tell when the board is unreachable or the company is unknown', async () => {
    const down = fetchOf(() => Promise.resolve(new Response('x', { status: 404 })));
    expect(await atsConfirmLive(seeds, down)(posting())).toBeNull();
    expect(await atsConfirmLive(seeds, down)(posting({ companySlug: 'nobody' }))).toBeNull();
    const wrongShape = fetchOf(() => Promise.resolve(json({ nope: 1 })));
    expect(await atsConfirmLive(seeds, wrongShape)(posting())).toBeNull();
  });
});

describe('rescueWithHostedUrl', () => {
  const seeds: CompanySeed[] = [{ slug: 'acme', name: 'Acme', source: 'greenhouse', token: 'acmeboard', industry: 'finance' }];
  const broken = (): Posting => posting({ applyUrl: 'https://www.acme.com/careers/gh?gh_jid=1234', linkStatus: 'dead' });
  const hosted = 'https://job-boards.greenhouse.io/acmeboard/jobs/1234';

  it('replaces a dead employer-site link with the Greenhouse-hosted page when that page resolves', async () => {
    const p = broken();
    const fake = fetchOf((url) => reply(url === hosted ? 200 : 404, url)());
    expect(await rescueWithHostedUrl([p], seeds, fake)).toBe(1);
    expect(p.applyUrl).toBe(hosted);
    expect(p.linkStatus).toBe('ok');
  });

  it('leaves the posting dead when the hosted page is gone too', async () => {
    const p = broken();
    expect(await rescueWithHostedUrl([p], seeds, fetchOf((url) => reply(404, url)()))).toBe(0);
    expect(p.linkStatus).toBe('dead');
    expect(p.applyUrl).toContain('acme.com');
  });

  it('does not rescue when the ATS says the job is closed', async () => {
    const p = broken();
    const fake = fetchOf((url) => reply(200, url)());
    expect(await rescueWithHostedUrl([p], seeds, fake, { confirmLive: () => Promise.resolve(false) })).toBe(0);
    expect(p.linkStatus).toBe('dead');
  });

  it('only touches dead Greenhouse links on employer domains', async () => {
    const fake = fetchOf((url) => reply(200, url)());
    const alreadyHosted = posting({ linkStatus: 'dead' }); // job-boards.greenhouse.io: a real closed job
    const lever = posting({ source: 'lever', linkStatus: 'dead', applyUrl: 'https://jobs.lever.co/acme/1234' });
    const fine = posting({ applyUrl: 'https://www.acme.com/x?gh_jid=1234', linkStatus: 'ok' });
    expect(await rescueWithHostedUrl([alreadyHosted, lever, fine], seeds, fake)).toBe(0);
    expect([alreadyHosted.linkStatus, lever.linkStatus, fine.linkStatus]).toEqual(['dead', 'dead', 'ok']);
  });
});
