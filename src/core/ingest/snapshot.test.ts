import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { HistoryFile, IndustryId, Posting, Snapshot } from '../types.ts';
import {
  buildHistory,
  buildIndex,
  buildPreviousMap,
  readLatest,
  readSnapshots,
  serializeSnapshot,
  trackingSinceFor,
  writeSnapshotFiles,
} from './snapshot.ts';

function post(over: Partial<Posting> & { slug: string; title: string; ext: string }): Posting {
  const { slug, title, ext, ...rest } = over;
  return {
    id: `greenhouse:${slug}:${ext}`,
    source: 'greenhouse',
    company: slug.toUpperCase(),
    companySlug: slug,
    externalId: ext,
    title,
    normalizedTitle: title.toLowerCase(),
    department: null,
    locations: [],
    cities: [],
    remote: false,
    postedAt: null,
    updatedAt: null,
    applyUrl: `https://job-boards.greenhouse.io/${slug}/jobs/${ext}`,
    description: '',
    compensation: null,
    firstSeen: '2026-10-01',
    lastSeen: '2026-10-01',
    linkVerifiedAt: '2026-10-01T10:00:00.000Z',
    linkStatus: 'ok',
    isInternship: true,
    eligibility: { gradYears: [], phrases: [], evidence: null },
    classification: { industry: 'finance', career: 'asset-management', family: 'business', method: 'rules', confidence: 0.9, evidence: [] },
    requirements: { required: [], preferred: [], minGpa: null, majors: [] },
    deadline: null,
    cycle: 'summer-2027',
    dedupeKey: `${slug}|${title.toLowerCase()}|summer-2027`,
    ...rest,
  };
}

const snap = (date: string, postings: Posting[]): Snapshot => ({
  schemaVersion: 1,
  dataset: 'live',
  pulledAt: `${date}T11:00:00.000Z`,
  date,
  trackingSince: '2026-10-01',
  sources: [],
  postings,
});

const industry = (id: IndustryId): Posting['classification'] => ({ industry: id, career: 'marketing', family: 'business', method: 'rules', confidence: 0.9, evidence: [] });

describe('buildHistory over three snapshots', () => {
  // d1: A, B   d2: A, B, C   d3: A, C        (B disappears; C appears on d2; D is dead on d3)
  const A1 = post({ slug: 'a', title: 'Analyst Intern', ext: '1', firstSeen: '2026-10-01', lastSeen: '2026-10-01' });
  const B1 = post({ slug: 'b', title: 'Trading Intern', ext: '2', firstSeen: '2026-10-01', lastSeen: '2026-10-01', postedAt: '2026-09-20T00:00:00.000Z' });
  const A2 = { ...A1, lastSeen: '2026-10-02' };
  const B2 = { ...B1, lastSeen: '2026-10-02' };
  const C2 = post({ slug: 'c', title: 'Marketing Intern', ext: '3', firstSeen: '2026-10-02', lastSeen: '2026-10-02', classification: industry('consumer') });
  const A3 = { ...A1, lastSeen: '2026-10-03' };
  const C3 = { ...C2, lastSeen: '2026-10-03', compensation: { min: 30, max: 30, unit: 'hour' as const, currency: 'USD', source: 'field' as const, raw: '$30 per hour' } };
  const D3 = post({ slug: 'd', title: 'Ops Intern', ext: '4', firstSeen: '2026-10-03', lastSeen: '2026-10-03', linkStatus: 'dead' });
  const E3 = post({ slug: 'e', title: 'Senior Manager', ext: '5', firstSeen: '2026-10-03', lastSeen: '2026-10-03', isInternship: false });
  const snaps = [snap('2026-10-03', [A3, C3, D3, E3]), snap('2026-10-01', [A1, B1]), snap('2026-10-02', [A2, B2, C2])]; // deliberately unsorted
  const h: HistoryFile = buildHistory(snaps, '2026-10-03T12:00:00.000Z');

  it('is tracked since the earliest snapshot', () => {
    expect(h.trackingSince).toBe('2026-10-01');
    expect(h.dataset).toBe('live');
    expect(h.builtAt).toBe('2026-10-03T12:00:00.000Z');
  });

  it('has one role per dedupeKey, ignoring dead links and non-internships', () => {
    expect(h.roles.map((r) => r.dedupeKey).sort()).toEqual(['a|analyst intern|summer-2027', 'b|trading intern|summer-2027', 'c|marketing intern|summer-2027']);
  });

  it('opens at the earlier of firstSeen and the ATS posted date', () => {
    const role = (k: string) => h.roles.find((r) => r.dedupeKey === k);
    expect(role('a|analyst intern|summer-2027')?.opened).toBe('2026-10-01');
    expect(role('b|trading intern|summer-2027')?.opened).toBe('2026-09-20'); // postedAt predates tracking
    expect(role('c|marketing intern|summer-2027')?.opened).toBe('2026-10-02');
  });

  it('closes at the last day seen, and stays null while it is in the latest snapshot', () => {
    const role = (k: string) => h.roles.find((r) => r.dedupeKey === k);
    expect(role('a|analyst intern|summer-2027')?.closed).toBeNull();
    expect(role('c|marketing intern|summer-2027')?.closed).toBeNull();
    expect(role('b|trading intern|summer-2027')?.closed).toBe('2026-10-02');
  });

  it('carries the newest compensation and classification onto the role', () => {
    const c = h.roles.find((r) => r.dedupeKey === 'c|marketing intern|summer-2027');
    expect(c?.compensation?.min).toBe(30);
    expect(c?.industry).toBe('consumer');
    expect(c?.company).toBe('C');
  });

  it('counts live internships per day and industry, and which of them opened that day', () => {
    expect(h.volume).toEqual([
      { date: '2026-10-01', industry: 'finance', open: 2, opened: 2 },
      { date: '2026-10-02', industry: 'consumer', open: 1, opened: 1 },
      { date: '2026-10-02', industry: 'finance', open: 2, opened: 0 },
      { date: '2026-10-03', industry: 'consumer', open: 1, opened: 0 },
      { date: '2026-10-03', industry: 'finance', open: 1, opened: 0 },
    ]);
  });

  it('collapses one role posted in several cities into a single history role but counts each posting in volume', () => {
    const ny = post({ slug: 'z', title: 'Quant Intern', ext: '10', dedupeKey: 'z|quant intern|summer-2027' });
    const chi = post({ slug: 'z', title: 'Quant Intern', ext: '11', dedupeKey: 'z|quant intern|summer-2027' });
    const hist = buildHistory([snap('2026-10-01', [ny, chi])], '2026-10-01T12:00:00.000Z');
    expect(hist.roles).toHaveLength(1);
    expect(hist.volume).toEqual([{ date: '2026-10-01', industry: 'finance', open: 2, opened: 2 }]);
  });

  it('handles no snapshots', () => {
    const empty = buildHistory([], '2026-10-01T12:00:00.000Z');
    expect(empty.roles).toEqual([]);
    expect(empty.volume).toEqual([]);
    expect(empty.trackingSince).toBe('2026-10-01');
  });
});

describe('small helpers', () => {
  it('buildIndex lists dates ascending and the latest', () => {
    expect(buildIndex([snap('2026-10-02', []), snap('2026-10-01', [])])).toEqual({ dates: ['2026-10-01', '2026-10-02'], latest: '2026-10-02' });
    expect(buildIndex([])).toEqual({ dates: [], latest: null });
  });

  it('buildPreviousMap keeps the newest copy with the earliest firstSeen', () => {
    const old = post({ slug: 'a', title: 'T Intern', ext: '1', firstSeen: '2026-10-01', description: 'old' });
    const recent = post({ slug: 'a', title: 'T Intern', ext: '1', firstSeen: '2026-10-05', description: 'new' });
    const map = buildPreviousMap([snap('2026-10-05', [recent]), snap('2026-10-01', [old])]);
    expect(map.get(old.id)?.description).toBe('new');
    expect(map.get(old.id)?.firstSeen).toBe('2026-10-01');
  });

  it('trackingSinceFor is the earliest of existing snapshots and today', () => {
    expect(trackingSinceFor([], '2026-10-15')).toBe('2026-10-15');
    expect(trackingSinceFor([snap('2026-10-03', [])], '2026-10-15')).toBe('2026-10-03');
  });

  it('serializeSnapshot is valid JSON with one posting per line', () => {
    const s = snap('2026-10-01', [post({ slug: 'a', title: 'T Intern', ext: '1' }), post({ slug: 'a', title: 'U Intern', ext: '2' })]);
    const text = serializeSnapshot(s);
    expect(JSON.parse(text)).toEqual(s);
    expect(text.trimEnd().split('\n')).toHaveLength(4); // header+[ , two postings, ]}
    expect(JSON.parse(serializeSnapshot(snap('2026-10-01', [])))).toEqual(snap('2026-10-01', []));
  });
});

describe('writeSnapshotFiles (temp dir)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'fifteen-snap-test-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes dated + latest snapshots, index.json and history.json, rebuilt from all dated snapshots', async () => {
    const A = post({ slug: 'a', title: 'Analyst Intern', ext: '1' });
    const B = post({ slug: 'b', title: 'Trading Intern', ext: '2' });
    await writeSnapshotFiles(dir, snap('2026-10-01', [A, B]));
    const second = await writeSnapshotFiles(dir, snap('2026-10-02', [{ ...A, lastSeen: '2026-10-02' }]));

    const read = (p: string) => readFile(path.join(dir, p), 'utf8');
    expect(JSON.parse(await read('snapshots/2026-10-01.json'))).toMatchObject({ date: '2026-10-01' });
    expect(JSON.parse(await read('snapshots/2026-10-02.json'))).toMatchObject({ date: '2026-10-02' });
    expect(await read('snapshots/latest.json')).toBe(await read('snapshots/2026-10-02.json'));
    expect(JSON.parse(await read('index.json'))).toEqual({ dates: ['2026-10-01', '2026-10-02'], latest: '2026-10-02' });

    const history = JSON.parse(await read('history.json')) as HistoryFile;
    expect(history).toEqual(second.history);
    expect(history.trackingSince).toBe('2026-10-01');
    expect(history.roles.find((r) => r.companySlug === 'b')?.closed).toBe('2026-10-01');
    expect(history.roles.find((r) => r.companySlug === 'a')?.closed).toBeNull();
    expect(history.volume.map((v) => [v.date, v.open])).toEqual([['2026-10-01', 2], ['2026-10-02', 1]]);

    expect((await readSnapshots(dir)).map((s) => s.date)).toEqual(['2026-10-01', '2026-10-02']);
    expect((await readLatest(dir))?.date).toBe('2026-10-02');
  });

  it('overwrites the same day instead of duplicating it', async () => {
    await writeSnapshotFiles(dir, snap('2026-10-01', [post({ slug: 'a', title: 'A Intern', ext: '1' })]));
    await writeSnapshotFiles(dir, snap('2026-10-01', [post({ slug: 'a', title: 'A Intern', ext: '1' }), post({ slug: 'a', title: 'B Intern', ext: '2' })]));
    expect((await readSnapshots(dir)).map((s) => s.postings.length)).toEqual([2]);
  });

  it('reads an empty data dir as no snapshots', async () => {
    expect(await readSnapshots(path.join(dir, 'nope'))).toEqual([]);
    expect(await readLatest(path.join(dir, 'nope'))).toBeNull();
  });
});
