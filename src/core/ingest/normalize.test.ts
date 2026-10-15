import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dedupeKey, normalizeTitle } from '../cycle.ts';
import { extractCompensationFromText, htmlToText } from '../classify/index.ts';
import type { CompanySeed, Posting } from '../types.ts';
import type { RawJob } from './adapter.ts';
import { parseGreenhouse } from './greenhouse.ts';
import { DESCRIPTION_CAP, capText, normalizeJob } from './normalize.ts';

const seed: CompanySeed = { slug: 'acme-capital', name: 'Acme Capital', source: 'greenhouse', token: 'acme', industry: 'finance' };

const raw = (over: Partial<RawJob> = {}): RawJob => ({
  externalId: '4242',
  title: 'Summer 2027 Investment Banking Analyst Internship - New York',
  department: 'Investment Banking',
  locations: ['New York, NY'],
  remoteHint: false,
  postedAt: '2026-09-15T12:00:00.000Z',
  updatedAt: '2026-09-20T12:00:00.000Z',
  applyUrl: 'https://boards.greenhouse.io/acme/jobs/4242',
  descriptionHtml: '<p>Join our <b>summer</b> analyst class.</p><ul><li>Excel</li></ul>',
  compensation: null,
  ...over,
});

const ctx = (previous: Map<string, Posting> = new Map()) => ({ pulledAt: '2026-10-15T11:00:00.000Z', today: '2026-10-15', previous });

describe('normalizeJob', () => {
  it('builds the id from source, company slug and external id', () => {
    const p = normalizeJob(raw(), seed, ctx());
    expect(p.id).toBe('greenhouse:acme-capital:4242');
    expect(p).toMatchObject({ source: 'greenhouse', company: 'Acme Capital', companySlug: 'acme-capital', externalId: '4242' });
  });

  it('copies the posting facts from the raw job', () => {
    const p = normalizeJob(raw({ remoteHint: true }), seed, ctx());
    expect(p.title).toBe('Summer 2027 Investment Banking Analyst Internship - New York');
    expect(p.applyUrl).toBe('https://boards.greenhouse.io/acme/jobs/4242');
    expect(p.department).toBe('Investment Banking');
    expect(p.locations).toEqual(['New York, NY']);
    expect(p.postedAt).toBe('2026-09-15T12:00:00.000Z');
    expect(p.updatedAt).toBe('2026-09-20T12:00:00.000Z');
    expect(p.remote).toBe(true);
    expect(p.isInternship).toBe(true);
  });

  it('starts every link as unchecked', () => {
    const p = normalizeJob(raw(), seed, ctx());
    expect(p.linkStatus).toBe('unchecked');
    expect(p.linkVerifiedAt).toBeNull();
  });

  it('strips HTML from the description', () => {
    const p = normalizeJob(raw(), seed, ctx());
    expect(p.description).not.toMatch(/[<>]/);
    expect(p.description).toContain('Join our');
    expect(p.description).toContain('Excel');
  });

  describe('firstSeen / lastSeen', () => {
    it('is today for a posting we have not seen', () => {
      const p = normalizeJob(raw(), seed, ctx());
      expect(p.firstSeen).toBe('2026-10-15');
      expect(p.lastSeen).toBe('2026-10-15');
    });

    it('carries firstSeen from the previous snapshot and always bumps lastSeen', () => {
      const first = normalizeJob(raw(), seed, { ...ctx(), today: '2026-09-20' });
      expect(first.firstSeen).toBe('2026-09-20');
      const again = normalizeJob(raw(), seed, ctx(new Map([[first.id, first]])));
      expect(again.firstSeen).toBe('2026-09-20');
      expect(again.lastSeen).toBe('2026-10-15');
    });

    it('does not carry firstSeen across different ids', () => {
      const other = normalizeJob(raw({ externalId: '1' }), seed, { ...ctx(), today: '2026-09-01' });
      const p = normalizeJob(raw({ externalId: '2' }), seed, ctx(new Map([[other.id, other]])));
      expect(p.firstSeen).toBe('2026-10-15');
    });
  });

  describe('cycle and dedupe key', () => {
    it('takes the cycle from an explicit year in the title', () => {
      expect(normalizeJob(raw(), seed, ctx()).cycle).toBe('summer-2027');
    });

    it('otherwise uses the cycle it was first seen open in (autumn recruits for next summer)', () => {
      const p = normalizeJob(raw({ title: 'Finance Intern', postedAt: '2026-10-01T00:00:00.000Z' }), seed, ctx());
      expect(p.cycle).toBe('summer-2027');
    });

    it('ignores an old ATS posted date (evergreen reqs) when there is no year in the title', () => {
      const p = normalizeJob(raw({ title: 'Finance Intern', postedAt: '2016-03-01T00:00:00.000Z' }), seed, ctx());
      expect(p.cycle).toBe('summer-2027');
    });

    it('keeps the cycle stable on later days because firstSeen is carried', () => {
      const spring = normalizeJob(raw({ title: 'Finance Intern' }), seed, { ...ctx(), today: '2026-03-01' });
      expect(spring.cycle).toBe('summer-2026');
      const later = normalizeJob(raw({ title: 'Finance Intern' }), seed, ctx(new Map([[spring.id, spring]])));
      expect(later.cycle).toBe('summer-2026');
      expect(later.dedupeKey).toBe(spring.dedupeKey);
    });

    it('builds dedupeKey from company slug, normalized title and cycle', () => {
      const p = normalizeJob(raw(), seed, ctx());
      expect(p.normalizedTitle).toBe(normalizeTitle(p.title));
      expect(p.dedupeKey).toBe(dedupeKey('acme-capital', p.normalizedTitle, p.cycle));
      expect(p.dedupeKey.startsWith('acme-capital|')).toBe(true);
    });

    it('collapses a repost with a new id and decorated title to the same key', () => {
      const a = normalizeJob(raw({ externalId: '1', title: 'Summer 2027 Finance Intern' }), seed, ctx());
      const b = normalizeJob(raw({ externalId: '2', title: 'Finance Internship (Hybrid) - Summer 2027' }), seed, ctx());
      expect(a.id).not.toBe(b.id);
      expect(a.dedupeKey).toBe(b.dedupeKey);
    });
  });

  describe('description cap', () => {
    it('keeps short text intact', () => {
      expect(capText('hello')).toBe('hello');
    });

    it('caps long text at 6000 characters with an ellipsis', () => {
      const capped = capText('word '.repeat(5000));
      expect(capped.length).toBeLessThanOrEqual(DESCRIPTION_CAP);
      expect(capped.endsWith('…')).toBe(true);
    });

    it('caps the stored description but not the text the classifiers read', () => {
      const html = `<p>Summer analyst internship.</p><p>${'filler text '.repeat(1000)}</p><p>Pay: $30 per hour</p>`;
      const p = normalizeJob(raw({ descriptionHtml: html }), seed, ctx());
      expect(p.description.length).toBeLessThanOrEqual(DESCRIPTION_CAP);
      expect(htmlToText(html).length).toBeGreaterThan(DESCRIPTION_CAP);
    });
  });

  describe('compensation', () => {
    it('prefers the ATS field over pay text in the description', () => {
      const field = { min: 40, max: 40, unit: 'hour' as const, currency: 'USD', source: 'field' as const, raw: '$40 per hour' };
      const p = normalizeJob(raw({ compensation: field, descriptionHtml: '<p>The pay range is $20 - $25 per hour.</p>' }), seed, ctx());
      expect(p.compensation).toEqual(field);
    });

    it('otherwise uses whatever the text extractor finds in the description', () => {
      const html = '<p>Summer internship. The hourly rate is $32 - $36 per hour.</p>';
      const p = normalizeJob(raw({ descriptionHtml: html }), seed, ctx());
      expect(p.compensation).toEqual(extractCompensationFromText(htmlToText(html)));
    });

    it('is null when there is no pay anywhere', () => {
      const p = normalizeJob(raw({ descriptionHtml: '<p>Great team, great culture.</p>' }), seed, ctx());
      expect(p.compensation).toBeNull();
    });
  });

  describe('with recorded fixtures', () => {
    const jobs = parseGreenhouse(JSON.parse(readFileSync(new URL('./__fixtures__/greenhouse-jobs.json', import.meta.url), 'utf8')) as unknown);
    const coinbase: CompanySeed = { slug: 'coinbase', name: 'Coinbase', source: 'greenhouse', token: 'coinbase', industry: 'finance' };
    const postings = jobs.map((j) => normalizeJob(j, coinbase, ctx()));

    it('flags the three interns and not the two full-time roles', () => {
      const interns = postings.filter((p) => p.isInternship).map((p) => p.title);
      expect(interns).toEqual(['Accounting Intern', 'Credit Risk Intern', 'Associate Product Manager Intern']);
    });

    it('keeps ATS pay on the intern postings', () => {
      const accounting = postings.find((p) => p.externalId === '8173991');
      expect(accounting?.compensation).toMatchObject({ source: 'field', unit: 'hour', min: 40 });
    });

    it('produces unique ids', () => {
      expect(new Set(postings.map((p) => p.id)).size).toBe(postings.length);
    });
  });
});
