import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { CompanySeed } from '../types.ts';
import { ashbyAdapter, ashbyPay, ashbyUrl, parseAshby, parseSummaryText } from './ashby.ts';
import { greenhouseAdapter, greenhousePay, greenhouseUrl, parseGreenhouse } from './greenhouse.ts';
import { ADAPTERS } from './index.ts';
import { leverAdapter, leverPay, leverUrl, parseLever } from './lever.ts';
import { decodeEntities, HttpError } from './util.ts';

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8')) as unknown;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const seed = (source: CompanySeed['source'], token: string): CompanySeed => ({ slug: token, name: token, source, token, industry: 'finance' });

describe('decodeEntities', () => {
  it('decodes exactly one level, leaving inner entities for the HTML step', () => {
    expect(decodeEntities('&lt;p&gt;Tom &amp;amp; Jerry&lt;/p&gt;')).toBe('<p>Tom &amp; Jerry</p>');
  });
  it('handles quotes, apostrophes and numeric references', () => {
    expect(decodeEntities('&lt;a href=&quot;x&quot;&gt;it&#39;s &#x41;&lt;/a&gt;')).toBe('<a href="x">it\'s A</a>');
  });
  it('leaves unknown entities alone', () => {
    expect(decodeEntities('&bogus; and &amp;')).toBe('&bogus; and &');
  });
});

describe('greenhouse adapter', () => {
  const jobs = parseGreenhouse(fixture('greenhouse-jobs.json'));
  const byId = (id: string) => {
    const j = jobs.find((x) => x.externalId === id);
    if (!j) throw new Error(`fixture job ${id} missing`);
    return j;
  };

  it('parses every job in the fixture', () => {
    expect(jobs.map((j) => j.externalId)).toEqual(['8173991', '8175369', '8168322', '8154987', '8114684']);
  });

  it('uses the employer-facing absolute_url as the apply link', () => {
    expect(byId('8173991').applyUrl).toBe('https://www.coinbase.com/careers/positions/8173991?gh_jid=8173991');
    for (const j of jobs) expect(j.applyUrl).toMatch(/^https:\/\/www\.coinbase\.com\/careers\/positions\/\d+\?gh_jid=\d+$/);
  });

  it('reads department, locations (primary plus offices, de-duplicated) and ISO dates', () => {
    const j = byId('8173991');
    expect(j.title).toBe('Accounting Intern');
    expect(j.department).toBe('Internships & Emerging Talent Positions');
    expect(j.locations[0]).toBe('Hybrid - New York, NY');
    expect(new Set(j.locations).size).toBe(j.locations.length);
    expect(j.postedAt).toBe('2026-09-08T22:28:47.000Z'); // first_published, offset normalised to UTC
    expect(j.updatedAt).toBe('2026-10-13T23:51:20.000Z');
  });

  it('decodes the escaped content into real HTML', () => {
    const html = byId('8173991').descriptionHtml;
    expect(html).toContain('<p>');
    expect(html).not.toContain('&lt;');
  });

  it('flags remote from the primary location, not from pay-zone offices', () => {
    expect(byId('8114684').remoteHint).toBe(true); // "Remote - USA"
    expect(byId('8173991').remoteHint).toBe(false); // "Hybrid - New York" even though an office says "Remote Zone 1"
  });

  it('turns pay_input_ranges (cents) into field compensation with the right unit', () => {
    expect(byId('8173991').compensation).toMatchObject({ min: 40, max: 40, unit: 'hour', currency: 'USD', source: 'field' });
    expect(byId('8114684').compensation).toMatchObject({ min: 108630, max: 127800, unit: 'year', currency: 'USD', source: 'field' });
    expect(byId('8154987').compensation).toMatchObject({ min: 76500, max: 85000, unit: 'year', currency: 'GBP' });
  });

  it('collapses several pay zones to lowest min and highest max', () => {
    const c = greenhousePay([
      { min_cents: 14_700_000, max_cents: 17_200_000, currency_type: 'USD', title: 'Zone 2' },
      { min_cents: 13_000_000, max_cents: 15_200_000, currency_type: 'USD', title: 'Zone 3' },
      { min_cents: 16_600_000, max_cents: 19_500_000, currency_type: 'USD', title: 'Zone 1' },
    ]);
    expect(c).toMatchObject({ min: 130000, max: 195000, unit: 'year' });
  });

  it('returns null pay for an empty or missing range list', () => {
    expect(greenhousePay([])).toBeNull();
    expect(greenhousePay(undefined)).toBeNull();
  });

  it('falls back to updated_at when first_published is absent', () => {
    const [j] = parseGreenhouse({ jobs: [{ id: 1, title: 'X Intern', absolute_url: 'https://e.com/1', updated_at: '2026-01-02T00:00:00Z', location: { name: 'NYC' }, content: '', offices: [], departments: [] }] });
    expect(j?.postedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(j?.department).toBeNull();
  });

  it('throws on a body that is not a board', () => {
    expect(() => parseGreenhouse({ nope: true })).toThrow(/no jobs array/);
  });

  it('fetches the documented endpoint', async () => {
    const urls: string[] = [];
    const fake = ((url: string) => {
      urls.push(url);
      return Promise.resolve(jsonResponse(fixture('greenhouse-jobs.json')));
    }) as unknown as typeof fetch;
    const out = await greenhouseAdapter.fetchJobs(seed('greenhouse', 'coinbase'), fake);
    expect(out).toHaveLength(5);
    expect(urls).toEqual([greenhouseUrl('coinbase')]);
    expect(urls[0]).toMatch(/^https:\/\/boards-api\.greenhouse\.io\/v1\/boards\/coinbase\/jobs\?content=true/);
  });

  it('surfaces a 404 board as an HttpError without retrying', async () => {
    let calls = 0;
    const fake = (() => {
      calls += 1;
      return Promise.resolve(new Response('not found', { status: 404 }));
    }) as unknown as typeof fetch;
    await expect(greenhouseAdapter.fetchJobs(seed('greenhouse', 'gone'), fake)).rejects.toBeInstanceOf(HttpError);
    expect(calls).toBe(1);
  });
});

describe('lever adapter', () => {
  const jobs = parseLever(fixture('lever-postings.json'));
  const byId = (id: string) => {
    const j = jobs.find((x) => x.externalId === id);
    if (!j) throw new Error(`fixture job ${id} missing`);
    return j;
  };

  it('parses every posting in the fixture', () => {
    expect(jobs).toHaveLength(6);
  });

  it('uses hostedUrl as the apply link', () => {
    expect(byId('cbde47db-c60b-4339-a8f4-a8e4f30505ab').applyUrl).toBe('https://jobs.lever.co/belvederetrading/cbde47db-c60b-4339-a8f4-a8e4f30505ab');
    for (const j of jobs) expect(j.applyUrl).toMatch(/^https:\/\/jobs\.lever\.co\/[a-z]+\/[0-9a-f-]{36}$/);
  });

  it('converts createdAt epoch milliseconds to ISO and has no updatedAt', () => {
    const j = byId('cbde47db-c60b-4339-a8f4-a8e4f30505ab');
    expect(j.postedAt).toBe(new Date(1785864478389).toISOString());
    expect(j.updatedAt).toBeNull();
  });

  it('reads department (falling back to team) and locations', () => {
    expect(byId('cbde47db-c60b-4339-a8f4-a8e4f30505ab').department).toBe('Trading');
    expect(byId('7d80b740-559e-484f-b0a2-8439011cf363').department).toBe('Sales'); // no department category: team
    expect(byId('cbde47db-c60b-4339-a8f4-a8e4f30505ab').locations).toEqual(['Chicago, Illinois']);
  });

  it('flags remote from workplaceType', () => {
    expect(byId('7d80b740-559e-484f-b0a2-8439011cf363').remoteHint).toBe(true);
    expect(byId('cbde47db-c60b-4339-a8f4-a8e4f30505ab').remoteHint).toBe(false);
  });

  it('stitches description + lists + additional into one HTML document', () => {
    const raw = fixture('lever-postings.json') as { lists: { text: string }[] }[];
    const html = byId('cbde47db-c60b-4339-a8f4-a8e4f30505ab').descriptionHtml;
    const firstList = raw[0]?.lists[0];
    expect(firstList).toBeDefined();
    expect(html).toContain(`<h3>${(firstList?.text ?? '').trim()}</h3>`);
    expect(html).toContain('<ul>');
    expect(html).toContain('Belvedere Trading');
  });

  it('maps salaryRange to field compensation, null when absent', () => {
    expect(byId('cbde47db-c60b-4339-a8f4-a8e4f30505ab').compensation).toMatchObject({ min: 140000, max: 140000, unit: 'year', currency: 'USD', source: 'field' });
    expect(byId('70da6a35-19ab-4a10-8f8e-ccc3cbf39a14').compensation).toMatchObject({ min: 175000, max: 250000 });
    expect(byId('25963deb-5dfd-42da-88b4-3cd3b5d8d5ef').compensation).toBeNull();
  });

  it('understands the other salary intervals', () => {
    expect(leverPay({ min: 25, max: 30, currency: 'USD', interval: 'per-hour-wage' })).toMatchObject({ unit: 'hour' });
    expect(leverPay({ min: 5_000_000, max: 8_000_000, currency: 'COP', interval: 'per-month-salary' })).toMatchObject({ unit: 'month', currency: 'COP' });
    expect(leverPay({ min: 1, max: 2, currency: 'USD', interval: 'one-time' })).toBeNull();
  });

  it('throws on a body that is not an array', () => {
    expect(() => parseLever({ ok: false })).toThrow(/not an array/);
  });

  it('fetches the documented endpoint', async () => {
    const urls: string[] = [];
    const fake = ((url: string) => {
      urls.push(url);
      return Promise.resolve(jsonResponse(fixture('lever-postings.json')));
    }) as unknown as typeof fetch;
    const out = await leverAdapter.fetchJobs(seed('lever', 'belvederetrading'), fake);
    expect(out).toHaveLength(6);
    expect(urls).toEqual([leverUrl('belvederetrading')]);
    expect(urls[0]).toBe('https://api.lever.co/v0/postings/belvederetrading?mode=json');
  });
});

describe('ashby adapter', () => {
  const jobs = parseAshby(fixture('ashby-board.json'));
  const byId = (id: string) => {
    const j = jobs.find((x) => x.externalId === id);
    if (!j) throw new Error(`fixture job ${id} missing`);
    return j;
  };

  it('parses every job in the fixture', () => {
    expect(jobs).toHaveLength(5);
  });

  it('uses jobUrl (the posting page) as the apply link', () => {
    for (const j of jobs) expect(j.applyUrl).toBe(`https://jobs.ashbyhq.com/ramp/${j.externalId}`);
  });

  it('reads publishedAt, department, trimmed titles and merged locations', () => {
    const j = byId('34413f8d-26bf-4bbc-8ade-eb309a0e2245');
    expect(j.title).toBe('Security Engineer, Cloud'); // source has a leading space
    expect(j.department).toBe('Engineering');
    expect(j.postedAt).toBe('2026-04-07T17:12:35.753Z');
    expect(j.locations).toEqual(['New York, NY (HQ)', 'Remote (Canada)', 'Remote (US)', 'Miami, FL']);
  });

  it('prefers workplaceType over the unreliable isRemote flag', () => {
    expect(byId('d84bbf19-572a-499c-9c87-0c154ce85caf').remoteHint).toBe(true); // workplaceType Remote
    const hybridButFlaggedRemote = byId('b39ceb08-a0a7-4f8b-a760-2fb88e209956'); // Hybrid, isRemote:true
    expect(hybridButFlaggedRemote.remoteHint).toBe(false);
  });

  it('maps the Salary summary component, ignoring equity components', () => {
    expect(byId('b39ceb08-a0a7-4f8b-a760-2fb88e209956').compensation).toMatchObject({ min: 12500, max: 12500, unit: 'month', currency: 'USD', source: 'field' });
    expect(byId('acf6b28d-767f-483f-8ff2-114620cd7e04').compensation).toMatchObject({ min: 12500, unit: 'month' });
    expect(byId('4745807e-82f4-4b1a-857c-dc8dadc73076').compensation).toMatchObject({ min: 108000, max: 200000, unit: 'year' });
  });

  it('skips jobs that are not listed', () => {
    const out = parseAshby({ jobs: [{ id: 'a', title: 'X', jobUrl: 'https://jobs.ashbyhq.com/o/a', isListed: false }, { id: 'b', title: 'Y', jobUrl: 'https://jobs.ashbyhq.com/o/b', isListed: true }] });
    expect(out.map((j) => j.externalId)).toEqual(['b']);
  });

  it('parses hourly summary text when only the text is present', () => {
    expect(parseSummaryText('$48 per hour')).toMatchObject({ min: 48, max: 48, unit: 'hour', source: 'field' });
    expect(parseSummaryText('$211.4K - $290.6K')).toMatchObject({ min: 211400, max: 290600, unit: 'year' });
    expect(ashbyPay({ compensationTierSummary: '$12.5K per month' })).toMatchObject({ min: 12500, unit: 'month' });
    expect(ashbyPay({})).toBeNull();
  });

  it('throws on a body that is not a board', () => {
    expect(() => parseAshby([])).toThrow(/no jobs array/);
  });

  it('fetches the documented endpoint', async () => {
    const urls: string[] = [];
    const fake = ((url: string) => {
      urls.push(url);
      return Promise.resolve(jsonResponse(fixture('ashby-board.json')));
    }) as unknown as typeof fetch;
    const out = await ashbyAdapter.fetchJobs(seed('ashby', 'ramp'), fake);
    expect(out).toHaveLength(5);
    expect(urls).toEqual([ashbyUrl('ramp')]);
    expect(urls[0]).toBe('https://api.ashbyhq.com/posting-api/job-board/ramp?includeCompensation=true');
  });
});

describe('adapter registry', () => {
  it('registers one adapter per source id', () => {
    expect(Object.keys(ADAPTERS).sort()).toEqual(['ashby', 'greenhouse', 'lever']);
    for (const [source, adapter] of Object.entries(ADAPTERS)) expect(adapter.source).toBe(source);
  });
});
