import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { HistoryFile, Posting, Snapshot } from './types.ts';
import { CAREERS, CITIES, INDUSTRIES } from './taxonomy.ts';
import { SIGNALS, findSignals } from './signals.ts';
import { dedupeKey, normalizeTitle } from './cycle.ts';
import { generate, hashFiles, renderFiles } from '../../scripts/demo/generate.ts';
import { COMPANIES } from '../../scripts/demo/companies.ts';
import { PHRASES } from '../../scripts/demo/text.ts';

const dataDir = fileURLToPath(new URL('../../public/data/', import.meta.url));
const readText = (rel: string): string => readFileSync(`${dataDir}${rel}`, 'utf8');
const read = <T>(rel: string): T => JSON.parse(readText(rel)) as T;

const TODAY = '2026-10-15';

interface IndexFile {
  dates: string[];
  latest: string;
  dataset: string;
}

const demo = read<Snapshot>('demo/latest.json');
const demoHistory = read<HistoryFile>('demo/history.json');
const zero = read<Snapshot>('demo-zero/latest.json');
const zeroHistory = read<HistoryFile>('demo-zero/history.json');
const business = demo.postings.filter((p) => p.classification.family === 'business');

const BLOCKLIST = [
  'Goldman', 'Morgan Stanley', 'JPMorgan', 'McKinsey', 'Bain', 'BCG', 'Deloitte', 'PwC', 'EY', 'KPMG',
  'Google', 'Apple', 'Amazon', 'Meta', 'Microsoft', 'Nike', 'Coca-Cola',
];

const industryIds = new Set<string>(INDUSTRIES.map((i) => i.id));
const careerIds = new Set<string>(CAREERS.map((c) => c.id));
const cityIds = new Set<string>(CITIES.map((c) => c.id));
const signalIds = new Set(SIGNALS.map((s) => s.id));

const newToday = (snap: Snapshot, pred: (p: Posting) => boolean): number =>
  snap.postings.filter((p) => p.firstSeen === TODAY && pred(p)).length;

describe('demo dataset: labels and shape', () => {
  it("marks dataset 'demo' on every file", () => {
    expect(demo.dataset).toBe('demo');
    expect(demoHistory.dataset).toBe('demo');
    expect(zero.dataset).toBe('demo');
    expect(zeroHistory.dataset).toBe('demo');
    for (const dir of ['demo', 'demo-zero']) {
      const index = read<IndexFile>(`${dir}/index.json`);
      expect(index).toEqual({ dates: [TODAY], latest: TODAY, dataset: 'demo' });
    }
  });

  it('has the agreed dates and size', () => {
    expect(demo.date).toBe(TODAY);
    expect(demo.pulledAt).toBe('2026-10-15T11:00:00.000Z');
    expect(demo.trackingSince).toBe('2025-08-01');
    expect(demoHistory.trackingSince).toBe('2025-08-01');
    expect(business.length).toBeGreaterThanOrEqual(2000);
    expect(business.length).toBe(2400);
    const nonBusiness = demo.postings.filter((p) => p.classification.family !== 'business');
    expect(nonBusiness.length).toBeGreaterThanOrEqual(100);
    expect(statSync(`${dataDir}demo/latest.json`).size).toBeLessThan(6_000_000);
  });

  it('uses source demo, in-app apply urls and verified links', () => {
    for (const p of demo.postings) {
      expect(p.source).toBe('demo');
      expect(p.id).toBe(`demo:${p.companySlug}:${p.externalId}`);
      expect(p.applyUrl.startsWith('/demo-posting/')).toBe(true);
      expect(p.applyUrl).toBe(`/demo-posting/${p.id}`);
      expect(p.linkStatus).toBe('ok');
      expect(p.linkVerifiedAt).toBe(demo.pulledAt);
      expect(p.isInternship).toBe(true);
      expect(p.cycle).toBe('summer-2027');
      expect(p.lastSeen).toBe(TODAY);
    }
  });

  it('has unique ids and unique dedupe keys that follow the cycle helpers', () => {
    expect(new Set(demo.postings.map((p) => p.id)).size).toBe(demo.postings.length);
    expect(new Set(demo.postings.map((p) => p.dedupeKey)).size).toBe(demo.postings.length);
    for (const p of demo.postings) {
      expect(p.normalizedTitle).toBe(normalizeTitle(p.title));
      expect(p.dedupeKey).toBe(dedupeKey(p.companySlug, p.normalizedTitle, p.cycle));
    }
  });

  it('only uses valid career, industry and city ids and covers them', () => {
    const careers = new Set<string>();
    const cities = new Set<string>();
    for (const p of demo.postings) {
      expect(industryIds.has(p.classification.industry)).toBe(true);
      expect(careerIds.has(p.classification.career)).toBe(true);
      expect(p.classification.method).toBe('rules');
      expect(p.classification.evidence.length).toBeGreaterThan(0);
      expect(p.cities.length).toBeGreaterThan(0);
      for (const c of p.cities) {
        expect(cityIds.has(c)).toBe(true);
        cities.add(c);
      }
      careers.add(p.classification.career);
    }
    for (const r of demoHistory.roles) {
      expect(industryIds.has(r.industry)).toBe(true);
      expect(careerIds.has(r.career)).toBe(true);
    }
    const businessCareers = CAREERS.filter((c) => c.family === 'business');
    for (const c of businessCareers) expect(careers.has(c.id)).toBe(true);
    for (const c of CITIES) expect(cities.has(c.id)).toBe(true);
    for (const i of INDUSTRIES) expect(business.some((p) => p.classification.industry === i.id)).toBe(true);
    expect(new Set(demo.postings.filter((p) => p.cities.length > 1).map((p) => p.id)).size).toBeGreaterThan(200);
  });

  it('covers the big cities well', () => {
    const count = (c: string): number => business.filter((p) => p.cities.includes(c as never)).length;
    for (const c of ['nyc', 'chicago', 'sf-bay', 'atlanta', 'remote']) expect(count(c)).toBeGreaterThan(150);
  });
});

describe('demo dataset: companies', () => {
  it('uses only fictional company names', () => {
    const names = new Set<string>([
      ...demo.postings.map((p) => p.company),
      ...demoHistory.roles.map((r) => r.company),
      ...COMPANIES.map((c) => c.name),
    ]);
    for (const name of names) {
      for (const bad of BLOCKLIST) {
        const re = new RegExp(`(^|[^A-Za-z])${bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z]|$)`, 'i');
        expect(re.test(name), `${name} vs ${bad}`).toBe(false);
      }
    }
  });

  it('has roughly seventy companies spread across every industry', () => {
    expect(COMPANIES.length).toBeGreaterThanOrEqual(68);
    expect(COMPANIES.length).toBeLessThanOrEqual(78);
    const per = new Map<string, number>();
    for (const c of COMPANIES) per.set(c.industry, (per.get(c.industry) ?? 0) + 1);
    expect(per.get('finance')).toBe(16);
    expect(per.get('consulting')).toBe(8);
    expect(per.get('accounting')).toBe(5);
    expect(per.get('technology')).toBe(12);
    expect(per.get('consumer')).toBe(10);
    expect(demo.sources.length).toBe(COMPANIES.length);
    expect(demo.sources.every((s) => s.source === 'demo' && s.ok)).toBe(true);
  });

  it('includes the companies other fixtures reference', () => {
    const by = (name: string): Posting[] => demo.postings.filter((p) => p.company === name);
    const cities = (ps: Posting[]): Set<string> => new Set(ps.flatMap((p) => p.cities));

    const peach = by('Peachtree Brands');
    expect(peach.length).toBeGreaterThan(20);
    expect(peach.every((p) => p.classification.industry === 'consumer')).toBe(true);
    expect(cities(peach).has('atlanta')).toBe(true);
    expect(peach.filter((p) => p.classification.career === 'marketing').length).toBeGreaterThan(10);

    const magnolia = by('Magnolia Media Group');
    expect(magnolia.length).toBeGreaterThan(15);
    expect(magnolia.every((p) => p.classification.industry === 'media')).toBe(true);
    expect(cities(magnolia).has('atlanta')).toBe(true);
    expect(magnolia.some((p) => p.classification.career === 'marketing')).toBe(true);

    const larkspur = by('Larkspur Consumer Co.');
    expect(larkspur.length).toBeGreaterThan(15);
    expect(cities(larkspur).has('atlanta')).toBe(true);
    expect(cities(larkspur).has('nyc')).toBe(true);
    expect(larkspur.some((p) => p.requirements.required.includes('social-media'))).toBe(true);

    const northwind = by('Northwind Capital');
    expect(northwind.length).toBeGreaterThan(30);
    expect(northwind.every((p) => p.classification.industry === 'finance')).toBe(true);
    expect(cities(northwind).has('nyc')).toBe(true);
    expect(northwind.some((p) => p.classification.career === 'investment-banking')).toBe(true);
    expect(northwind.some((p) => p.classification.career === 'sales-trading')).toBe(true);

    const halcyon = by('Halcyon Advisory');
    expect(halcyon.length).toBeGreaterThan(0);
    expect(halcyon.every((p) => p.classification.industry === 'consulting')).toBe(true);
    expect([...cities(halcyon)].every((c) => ['nyc', 'chicago', 'boston'].includes(c))).toBe(true);
    expect(demoHistory.roles.some((r) => r.company === 'Halcyon Advisory')).toBe(true);
  });
});

describe('demo dataset: new today', () => {
  it('has a modest number of roles first seen today', () => {
    const n = newToday(demo, () => true);
    expect(n).toBeGreaterThanOrEqual(60);
    expect(n).toBeLessThanOrEqual(90);
  });

  it('has new roles today for each persona combination', () => {
    expect(newToday(demo, (p) => p.cities.includes('atlanta') && p.classification.career === 'marketing')).toBeGreaterThanOrEqual(3);
    expect(newToday(demo, (p) => p.cities.includes('nyc') && p.classification.industry === 'finance')).toBeGreaterThanOrEqual(3);
    expect(newToday(demo, (p) => p.cities.includes('nyc') && p.classification.industry === 'consulting')).toBeGreaterThanOrEqual(3);
    expect(newToday(demo, (p) => p.cities.includes('remote') && p.classification.industry === 'finance')).toBeGreaterThanOrEqual(3);
    expect(newToday(demo, (p) => p.cities.includes('chicago') && p.classification.career === 'supply-chain')).toBeGreaterThanOrEqual(3);
  });

  it('spreads the rest of the first-seen dates over Aug 1 to Oct 15', () => {
    const dates = demo.postings.map((p) => p.firstSeen);
    expect(dates.every((d) => d >= '2026-08-01' && d <= TODAY)).toBe(true);
    expect(dates.some((d) => d === '2026-08-01' || d === '2026-08-02' || d === '2026-08-03')).toBe(true);
    const months = new Set(dates.map((d) => d.slice(0, 7)));
    expect(months).toEqual(new Set(['2026-08', '2026-09', '2026-10']));
    for (const p of demo.postings) {
      expect(p.postedAt).not.toBeNull();
      expect(p.updatedAt).not.toBeNull();
      expect((p.postedAt as string).slice(0, 10) <= p.firstSeen).toBe(true);
      expect((p.updatedAt as string) >= (p.postedAt as string)).toBe(true);
      expect((p.updatedAt as string) <= demo.pulledAt).toBe(true);
      expect((p.postedAt as string) >= '2026-08-01').toBe(true);
    }
  });
});

describe('demo-zero variant', () => {
  it('has no postings first seen today and is otherwise the same data', () => {
    expect(newToday(zero, () => true)).toBe(0);
    expect(zero.postings.length).toBe(demo.postings.length);
    expect(zero.postings.map((p) => p.id)).toEqual(demo.postings.map((p) => p.id));
    const moved = demo.postings.filter((p) => p.firstSeen === TODAY).length;
    expect(zero.postings.filter((p) => p.firstSeen === '2026-10-14').length).toBe(
      demo.postings.filter((p) => p.firstSeen === '2026-10-14').length + moved,
    );
    for (const p of zero.postings) {
      expect(p.postedAt === null || (p.postedAt as string).slice(0, 10) <= TODAY).toBe(true);
      expect((p.postedAt as string).startsWith(TODAY)).toBe(false);
    }
    expect(zeroHistory.roles.filter((r) => r.cycle === 'summer-2027' && r.opened === TODAY).length).toBe(0);
    expect(zeroHistory.roles.length).toBe(demoHistory.roles.length);
  });
});

describe('demo dataset: determinism', () => {
  it('regenerates byte-identical files', () => {
    const a = renderFiles(generate());
    const b = renderFiles(generate());
    expect(hashFiles(a)).toBe(hashFiles(b));
    const onDisk: Record<string, string> = {};
    for (const rel of Object.keys(a)) onDisk[rel] = readText(rel);
    expect(hashFiles(onDisk)).toBe(hashFiles(a));
  });
});

describe('demo dataset: requirements and text', () => {
  it('only references real signal ids', () => {
    for (const p of demo.postings) {
      for (const id of [...p.requirements.required, ...p.requirements.preferred, ...p.requirements.majors]) {
        expect(signalIds.has(id), id).toBe(true);
      }
      for (const m of p.requirements.majors) expect(m.startsWith('major:')).toBe(true);
      expect(p.requirements.required.length).toBeGreaterThanOrEqual(2);
      expect(p.requirements.required.length).toBeLessThanOrEqual(6);
      expect(p.requirements.preferred.length).toBeLessThanOrEqual(3);
      expect(p.requirements.preferred.some((id) => p.requirements.required.includes(id))).toBe(false);
    }
  });

  it('uses real alias phrases from signals.ts', () => {
    for (const [id, phrases] of Object.entries(PHRASES)) {
      const signal = SIGNALS.find((s) => s.id === id);
      expect(signal, id).toBeDefined();
      for (const p of phrases) expect(signal?.aliases.includes(p.toLowerCase()), `${id}: ${p}`).toBe(true);
    }
  });

  it('writes descriptions that contain the signals, eligibility, GPA, pay and deadline it claims', () => {
    for (const p of demo.postings) {
      const d = p.description;
      expect(d.length).toBeGreaterThanOrEqual(600);
      expect(d.length).toBeLessThanOrEqual(1600);
      expect(d).toContain('Qualifications');
      const found = new Set(findSignals(d));
      for (const id of [...p.requirements.required, ...p.requirements.preferred, ...p.requirements.majors]) {
        expect(found.has(id), `${p.id} missing ${id}`).toBe(true);
      }
      if (p.requirements.preferred.length > 0) expect(d).toContain('Preferred');
      if (p.requirements.minGpa !== null) expect(d).toContain(`${p.requirements.minGpa.toFixed(1)} GPA or higher`);
      if (p.eligibility.evidence) expect(d).toContain(p.eligibility.evidence);
      if (p.compensation?.source === 'description') expect(d).toContain(p.compensation.raw);
      if (p.deadline) expect(d).toContain('Apply by');
      expect(d).not.toMatch(/lorem ipsum/i);
    }
  });

  it('matches the requested distributions', () => {
    const n = demo.postings.length;
    const share = (pred: (p: Posting) => boolean): number => demo.postings.filter(pred).length / n;
    const years = (p: Posting): string => p.eligibility.gradYears.join('+');
    expect(share((p) => years(p) === '')).toBeGreaterThan(0.4);
    expect(share((p) => years(p) === '')).toBeLessThan(0.5);
    expect(share((p) => years(p) === '2028')).toBeGreaterThan(0.25);
    expect(share((p) => years(p) === '2028')).toBeLessThan(0.35);
    expect(share((p) => years(p) === '2029')).toBeGreaterThan(0.08);
    expect(share((p) => years(p) === '2029')).toBeLessThan(0.16);
    expect(share((p) => years(p) === '2030')).toBeGreaterThan(0.05);
    expect(share((p) => years(p) === '2030')).toBeLessThan(0.11);
    expect(share((p) => years(p) === '2028+2029')).toBeGreaterThan(0.03);
    expect(share((p) => years(p) === '2028+2029')).toBeLessThan(0.08);
    for (const p of demo.postings) {
      expect(p.eligibility.phrases.length > 0 || p.eligibility.gradYears.length === 0).toBe(true);
    }
    expect(share((p) => p.requirements.minGpa !== null)).toBeGreaterThan(0.25);
    expect(share((p) => p.requirements.minGpa !== null)).toBeLessThan(0.35);
    expect(share((p) => p.compensation !== null)).toBeGreaterThan(0.35);
    expect(share((p) => p.compensation !== null)).toBeLessThan(0.45);
    expect(share((p) => p.deadline !== null)).toBeGreaterThan(0.07);
    expect(share((p) => p.deadline !== null)).toBeLessThan(0.13);
  });

  it('prices roles between $18 and $62 an hour, banking highest', () => {
    const withPay = demo.postings.filter((p) => p.compensation);
    const sources = new Set(withPay.map((p) => p.compensation?.source));
    expect(sources).toEqual(new Set(['field', 'description']));
    for (const p of withPay) {
      const c = p.compensation;
      expect(c?.unit).toBe('hour');
      expect(c?.min).toBeGreaterThanOrEqual(18);
      expect(c?.max).toBeLessThanOrEqual(62);
      expect((c?.max as number) > (c?.min as number)).toBe(true);
    }
    const avg = (career: string): number => {
      const xs = withPay.filter((p) => p.classification.career === career).map((p) => p.compensation?.min as number);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(avg('investment-banking')).toBeGreaterThan(avg('marketing') + 15);
    expect(avg('sales-trading')).toBeGreaterThan(avg('people-hr') + 15);
  });

  it('puts deadlines between Oct 17 and Dec 15, several within five days at the starred companies', () => {
    for (const p of demo.postings) {
      if (p.deadline) {
        expect(p.deadline >= '2026-10-17' && p.deadline <= '2026-12-15').toBe(true);
      }
    }
    for (const company of ['Northwind Capital', 'Halcyon Advisory', 'Peachtree Brands']) {
      const soon = demo.postings.filter((p) => p.company === company && p.deadline && p.deadline <= '2026-10-20');
      expect(soon.length, company).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('demo history', () => {
  const thisCycle = demoHistory.roles.filter((r) => r.cycle === 'summer-2027');
  const lastCycle = demoHistory.roles.filter((r) => r.cycle === 'summer-2026');

  it('has a role for every current posting and ~85% of current titles last cycle', () => {
    const keys = new Set(thisCycle.map((r) => r.dedupeKey));
    for (const p of demo.postings) expect(keys.has(p.dedupeKey), p.dedupeKey).toBe(true);
    for (const r of thisCycle) {
      if (r.closed === null) {
        const p = demo.postings.find((x) => x.dedupeKey === r.dedupeKey);
        expect(p, r.dedupeKey).toBeDefined();
      }
    }
    const lastKeys = new Set(lastCycle.map((r) => r.dedupeKey));
    let matched = 0;
    for (const p of demo.postings) {
      if (lastKeys.has(dedupeKey(p.companySlug, p.normalizedTitle, 'summer-2026'))) matched++;
    }
    const ratio = matched / demo.postings.length;
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(0.9);
    expect(new Set(demoHistory.roles.map((r) => `${r.dedupeKey}`)).size).toBe(demoHistory.roles.length);
  });

  it('times last cycle inside the agreed window and by industry', () => {
    for (const r of lastCycle) {
      expect(r.opened >= '2025-07-15').toBe(true);
      expect(r.closed).not.toBeNull();
      expect((r.closed as string) <= '2026-04-30').toBe(true);
      expect((r.closed as string) > r.opened).toBe(true);
    }
    const median = (xs: string[]): string => xs.slice().sort()[Math.floor(xs.length / 2)] as string;
    const openedOf = (pred: (r: (typeof lastCycle)[number]) => boolean): string[] => lastCycle.filter(pred).map((r) => r.opened);
    const banking = median(openedOf((r) => r.career === 'investment-banking'));
    const consulting = median(openedOf((r) => r.industry === 'consulting' && r.career === 'consulting'));
    const accounting = median(openedOf((r) => r.career === 'accounting'));
    const marketing = median(openedOf((r) => r.career === 'marketing'));
    expect(banking < consulting).toBe(true);
    expect(consulting < accounting).toBe(true);
    expect(accounting < marketing).toBe(true);
    expect(banking >= '2025-07-15' && banking <= '2025-09-30').toBe(true);
    expect(marketing >= '2025-10-01').toBe(true);
  });

  it('predicts Halcyon Advisory opening soon, with no current postings that match', () => {
    const halcyonLast = lastCycle.filter((r) => r.companySlug === 'halcyon-advisory' && r.opened === '2025-10-19');
    expect(halcyonLast.length).toBeGreaterThanOrEqual(4);
    expect(halcyonLast.every((r) => r.career === 'consulting')).toBe(true);
    const current = demo.postings.filter((p) => p.companySlug === 'halcyon-advisory');
    expect(current.some((p) => p.classification.career === 'consulting')).toBe(false);
    const currentKeys = new Set(current.map((p) => p.normalizedTitle));
    for (const r of halcyonLast) expect(currentKeys.has(r.normalizedTitle)).toBe(false);
    // last cycle did not run these titles at any other time of year either
    expect(lastCycle.filter((r) => r.companySlug === 'halcyon-advisory').length).toBeGreaterThan(halcyonLast.length - 1);
  });

  it('has companies with no current postings whose windows opened Oct 18-22 last year', () => {
    const currentSlugs = new Set(demo.postings.map((p) => p.companySlug));
    const slugs = new Set(
      lastCycle
        .filter((r) => !currentSlugs.has(r.companySlug) && r.opened >= '2025-10-18' && r.opened <= '2025-10-22')
        .map((r) => r.companySlug),
    );
    expect(slugs.size).toBeGreaterThanOrEqual(3);
  });

  it('has one company whose roles are all closed', () => {
    const currentSlugs = new Set(demo.postings.map((p) => p.companySlug));
    const closedOnly = new Set<string>();
    for (const slug of new Set(demoHistory.roles.map((r) => r.companySlug))) {
      if (currentSlugs.has(slug)) continue;
      const roles = demoHistory.roles.filter((r) => r.companySlug === slug);
      if (roles.some((r) => r.cycle === 'summer-2027') && roles.every((r) => r.closed !== null)) closedOnly.add(slug);
    }
    expect(closedOnly.size).toBeGreaterThanOrEqual(1);
  });

  it('keeps volume rows consistent with the roles', () => {
    const industries = INDUSTRIES.map((i) => i.id);
    const days = new Set(demoHistory.volume.map((v) => v.date));
    expect(days.size).toBe(441);
    expect(demoHistory.volume.length).toBe(441 * industries.length);
    expect(demoHistory.volume[0]?.date).toBe('2025-08-01');
    expect(demoHistory.volume[demoHistory.volume.length - 1]?.date).toBe(TODAY);
    for (const v of demoHistory.volume) {
      if (v.date !== '2025-08-01' && v.date !== '2026-01-15' && v.date !== '2026-10-15' && v.date !== '2026-09-10') continue;
      const roles = demoHistory.roles.filter((r) => r.industry === v.industry);
      const open = roles.filter((r) => r.opened <= v.date && (r.closed === null || r.closed >= v.date)).length;
      const opened = roles.filter((r) => r.opened === v.date).length;
      expect(v.open, `${v.date} ${v.industry} open`).toBe(open);
      expect(v.opened, `${v.date} ${v.industry} opened`).toBe(opened);
    }
    const todayFinance = demoHistory.volume.find((v) => v.date === TODAY && v.industry === 'finance');
    const liveFinance = demo.postings.filter((p) => p.classification.industry === 'finance').length;
    expect(todayFinance?.open).toBe(liveFinance);
  });
});
