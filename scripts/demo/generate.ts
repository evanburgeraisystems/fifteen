import { createHash } from 'node:crypto';
import type {
  CareerId,
  CityId,
  Classification,
  Compensation,
  HistoryFile,
  HistoryRole,
  IndustryId,
  Posting,
  Snapshot,
  SourceRunResult,
} from '../../src/core/types.ts';
import { cycleId, dedupeKey, normalizeTitle } from '../../src/core/cycle.ts';
import { INDUSTRIES, labelCareer, labelIndustry, familyOf } from '../../src/core/taxonomy.ts';
import { BUSINESS_CAREER_IDS, CAREER_SPECS } from './careers.ts';
import type { CareerSpec } from './careers.ts';
import { COMPANIES, INDUSTRY_SHARES } from './companies.ts';
import type { CompanySpec } from './companies.ts';
import { Rng, hashString } from './prng.ts';
import { buildDescription, listText, longDate, majorList, pickEligibility } from './text.ts';
import type { EligKind } from './text.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SEED = 0x46494654; // "FIFT"
export const TODAY = '2026-10-15';
export const YESTERDAY = '2026-10-14';
export const PULLED_AT = '2026-10-15T11:00:00.000Z';
export const TRACKING_SINCE = '2025-08-01';
export const CURRENT_CYCLE = cycleId(2027);
export const LAST_CYCLE = cycleId(2026);
const FIRST_SEEN_START = '2026-08-01';
const BUSINESS_TOTAL = 2400;
const TODAY_TARGET = 78;

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const dayNumber = (iso: string): number => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
const isoOfDay = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10);
const addDays = (iso: string, n: number): string => isoOfDay(dayNumber(iso) + n);
const clampIso = (iso: string, lo: string, hi: string): string => (iso < lo ? lo : iso > hi ? hi : iso);
const pad2 = (n: number): string => String(n).padStart(2, '0');

// ---------------------------------------------------------------------------
// Taxonomy helpers
// ---------------------------------------------------------------------------

const LOCATIONS: Record<CityId, string[]> = {
  nyc: ['New York, NY'],
  chicago: ['Chicago, IL'],
  'sf-bay': ['San Francisco, CA'],
  boston: ['Boston, MA'],
  atlanta: ['Atlanta, GA'],
  'los-angeles': ['Los Angeles, CA'],
  seattle: ['Seattle, WA'],
  dc: ['Washington, DC'],
  dallas: ['Dallas, TX'],
  houston: ['Houston, TX'],
  charlotte: ['Charlotte, NC'],
  denver: ['Denver, CO'],
  austin: ['Austin, TX'],
  miami: ['Miami, FL'],
  philadelphia: ['Philadelphia, PA'],
  remote: ['Remote - US'],
  other: ['Columbus, OH', 'Pittsburgh, PA', 'Minneapolis, MN', 'Nashville, TN', 'Raleigh, NC'],
};

function proseCity(location: string): string {
  if (location === 'Washington, DC') return location;
  if (location === 'Remote - US') return 'Remote (US)';
  return location.split(',')[0] as string;
}

const csOf = (career: CareerId): CareerSpec => {
  const cs = CAREER_SPECS[career];
  if (!cs) throw new Error(`no career spec for ${career}`);
  return cs;
};

function teamName(career: CareerId, group: string | null, dept: string): string {
  if (!group) return dept;
  switch (career) {
    case 'sales': return `${group} Sales`;
    case 'operations': return `${group} Operations`;
    case 'marketing': return `${group} Marketing`;
    case 'strategy': return `${group} Strategy`;
    case 'supply-chain': return `Supply Chain ${group}`;
    case 'business-analytics':
      return /Intelligence|Insights|Data|Decision/.test(group) ? group : `${group} Analytics`;
    case 'product-management': return `${group} Product`;
    case 'real-estate': return group.startsWith('Real Estate') ? group : `Real Estate ${group}`;
    case 'software-engineering': return `${group} Engineering`;
    case 'data-science': return `${group} Data Science`;
    case 'design': return `${group} Design`;
    default: return group;
  }
}

// ---------------------------------------------------------------------------
// Timing categories (when does each kind of role open and close?)
// ---------------------------------------------------------------------------

type Category = 'finance-ib' | 'finance-other' | 'consulting' | 'accounting' | 'marketing' | 'ops' | 'tech' | 'other';

function categoryOf(career: CareerId, industry: IndustryId): Category {
  if (career === 'investment-banking' || career === 'sales-trading' || career === 'asset-management') return 'finance-ib';
  if (career === 'consulting' || career === 'strategy') return 'consulting';
  if (career === 'accounting') return 'accounting';
  if (career === 'marketing') return 'marketing';
  if (career === 'supply-chain' || career === 'operations') return 'ops';
  if (industry === 'finance') return 'finance-other';
  if (industry === 'technology') return 'tech';
  return 'other';
}

/** Current-cycle first-seen day offsets from 2026-08-01: [lo, hi, skew exponent]. */
const CURRENT_WINDOW: Record<Category, [number, number, number]> = {
  'finance-ib': [0, 70, 1.5],
  'finance-other': [10, 75, 1.2],
  consulting: [10, 75, 1.2],
  accounting: [25, 75, 0.9],
  marketing: [35, 75, 0.55],
  ops: [25, 75, 0.85],
  tech: [20, 75, 0.9],
  other: [20, 75, 0.8],
};

/** Last cycle's open-date window by category. */
const LAST_WINDOW: Record<Category, [string, string]> = {
  'finance-ib': ['2025-07-15', '2025-09-30'],
  'finance-other': ['2025-08-15', '2025-11-15'],
  consulting: ['2025-08-15', '2025-10-31'],
  accounting: ['2025-09-01', '2025-11-15'],
  marketing: ['2025-10-01', '2026-02-15'],
  ops: ['2025-09-01', '2026-01-15'],
  tech: ['2025-09-01', '2026-01-15'],
  other: ['2025-09-01', '2025-12-31'],
};

/** How long last cycle's roles stayed open, in days. */
const LAST_DURATION: Record<Category, [number, number]> = {
  'finance-ib': [20, 75],
  'finance-other': [30, 100],
  consulting: [30, 90],
  accounting: [45, 120],
  marketing: [60, 150],
  ops: [50, 140],
  tech: [50, 140],
  other: [50, 140],
};

/** Skew inside the open window: higher means more roles open early in it. */
const LAST_SKEW: Record<Category, number> = {
  'finance-ib': 1,
  'finance-other': 1.1,
  consulting: 1,
  accounting: 1,
  marketing: 1.6,
  ops: 1.4,
  tech: 1.3,
  other: 1,
};

const LAST_CYCLE_END = '2026-04-30';

// ---------------------------------------------------------------------------
// Compensation
// ---------------------------------------------------------------------------

const fmtUsd = (n: number): string => `$${n.toFixed(2)}`;

function makeCompensation(rng: Rng, cs: CareerSpec, bias: number, source: 'field' | 'description'): Compensation {
  const [lo, hi] = cs.pay;
  let min = lo + rng.int(0, Math.max(0, (hi - lo) * 2 - 8)) / 2 + bias;
  min = Math.min(Math.max(min, 18), 58);
  const spread = rng.int(2, 6);
  const max = Math.min(min + spread, 62);
  const range = `${fmtUsd(min)} - ${fmtUsd(max)} per hour`;
  return {
    min,
    max,
    unit: 'hour',
    currency: 'USD',
    source,
    raw: source === 'description' ? range : `${min.toFixed(2)}-${max.toFixed(2)} USD per hour`,
  };
}

function lowerCompensation(rng: Rng, c: Compensation): Compensation {
  const cut = rng.int(1, 2);
  const min = Math.max(18, (c.min ?? 18) - cut);
  const max = Math.max(min + 1, (c.max ?? min + 4) - cut);
  const range = `${fmtUsd(min)} - ${fmtUsd(max)} per hour`;
  return {
    ...c,
    min,
    max,
    raw: c.source === 'description' ? range : `${min.toFixed(2)}-${max.toFixed(2)} USD per hour`,
  };
}

// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

interface TitlePick {
  title: string;
  group: string | null;
}

const fill = (form: string, group: string | null): string =>
  form.replaceAll('{y}', 'Summer 2027').replaceAll('{g}', group ?? '');

function comboList(forms: string[], groups: string[], prefer: string[] | undefined): TitlePick[] {
  const out: TitlePick[] = [];
  for (const form of forms) {
    if (!form.includes('{g}')) {
      out.push({ title: fill(form, null), group: null });
      continue;
    }
    for (const g of groups) {
      const reps = prefer && prefer.includes(g) ? 5 : 1;
      for (let i = 0; i < reps; i++) out.push({ title: fill(form, g), group: g });
    }
  }
  return out;
}

function makeTitle(rng: Rng, cs: CareerSpec, kind: EligKind, used: Set<string>, prefer?: string[]): TitlePick {
  let programForms: string[] | null = null;
  if (kind === 'soph' && rng.chance(0.65)) programForms = cs.soph;
  else if (kind === 'fresh' && rng.chance(0.65)) programForms = cs.fresh;
  const tries: string[][] = [];
  if (programForms) tries.push(programForms);
  tries.push(cs.forms, cs.soph, cs.fresh);
  for (const forms of tries) {
    const combos = rng.shuffle(comboList(forms, cs.groups, prefer));
    for (const c of combos) {
      const norm = normalizeTitle(c.title);
      if (!used.has(norm)) {
        used.add(norm);
        return c;
      }
    }
  }
  throw new Error(`ran out of distinct titles for ${cs.career}`);
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

interface Reqs {
  required: string[];
  preferred: string[];
  majors: string[];
  minGpa: number | null;
}

function pickRequirements(rng: Rng, cs: CareerSpec, spec: CompanySpec): Reqs {
  const k = rng.weighted<number>([[2, 12], [3, 28], [4, 30], [5, 20], [6, 10]]);
  let required = rng.sampleBiased(cs.req, Math.min(k, cs.req.length));
  for (const id of spec.boost?.[cs.career] ?? []) {
    if (!required.includes(id) && rng.chance(0.85)) required = [id, ...required].slice(0, 6);
  }
  const nPref = rng.weighted<number>([[0, 25], [1, 30], [2, 30], [3, 15]]);
  const preferred = rng.sampleBiased(cs.pref.filter((id) => !required.includes(id)), nPref);
  let majors: string[] = [];
  if (rng.chance(0.65)) majors = rng.sampleBiased(cs.majors, Math.min(rng.int(1, 3), cs.majors.length));
  const minGpa = rng.chance(0.3)
    ? rng.weighted<number>([[3.0, 20], [3.2, 12], [3.3, 20], [3.4, 12], [3.5, 28], [3.6, 8]])
    : null;
  return { required, preferred, majors, minGpa };
}

// ---------------------------------------------------------------------------
// Company sizing
// ---------------------------------------------------------------------------

function allocateCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  // Industry totals by largest remainder.
  const raw = INDUSTRY_SHARES.map(([id, share]) => ({ id, exact: (share / 100) * BUSINESS_TOTAL }));
  const totals = new Map<IndustryId, number>(raw.map((r) => [r.id, Math.floor(r.exact)]));
  let short = BUSINESS_TOTAL - [...totals.values()].reduce((a, b) => a + b, 0);
  const byRemainder = raw
    .slice()
    .sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)));
  for (const r of byRemainder) {
    if (short <= 0) break;
    totals.set(r.id, (totals.get(r.id) ?? 0) + 1);
    short--;
  }
  for (const [industry, total] of totals) {
    const inIndustry = COMPANIES.filter((c) => c.industry === industry);
    let pool = total;
    for (const c of inIndustry) {
      if (c.noCurrent) counts.set(c.slug, 0);
      else if (c.fixedCount !== undefined) {
        counts.set(c.slug, c.fixedCount);
        pool -= c.fixedCount;
      }
    }
    const flexible = inIndustry.filter((c) => !c.noCurrent && c.fixedCount === undefined);
    const weightSum = flexible.reduce((a, c) => a + c.weight, 0);
    const parts = flexible.map((c) => ({ c, exact: (c.weight / weightSum) * pool }));
    let given = 0;
    for (const p of parts) {
      const n = Math.floor(p.exact);
      counts.set(p.c.slug, n);
      given += n;
    }
    const order = parts.slice().sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)));
    for (let i = 0; given < pool; i++, given++) {
      const p = order[i % order.length];
      if (p) counts.set(p.c.slug, (counts.get(p.c.slug) ?? 0) + 1);
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Posting generation
// ---------------------------------------------------------------------------

const HEAVY_CAREERS = new Set<CareerId>(['investment-banking', 'sales-trading', 'asset-management', 'consulting']);

interface CompanyState {
  spec: CompanySpec;
  rng: Rng;
  used: Set<string>;
  externalIds: Set<string>;
}

function externalId(state: CompanyState): string {
  const style = hashString(state.spec.slug) % 4;
  for (;;) {
    const n = state.rng.int(10000, 99999);
    const id = style === 0 ? `R-${n}` : style === 1 ? `REQ-${n}` : style === 2 ? `JR${n}` : `${n}0`;
    if (!state.externalIds.has(id)) {
      state.externalIds.add(id);
      return id;
    }
  }
}

function pickCities(rng: Rng, spec: CompanySpec, career: CareerId): CityId[] {
  const pool = spec.cities.filter(([c]) => !(c === 'remote' && (career === 'investment-banking' || career === 'sales-trading')));
  const usable = pool.length > 0 ? pool : spec.cities;
  const n = Math.min(rng.weighted<number>([[1, 72], [2, 20], [3, 8]]), usable.length);
  const out: CityId[] = [];
  while (out.length < n) {
    const c = rng.weighted(usable);
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

function pickCareerFromMix(rng: Rng, spec: CompanySpec): CareerId {
  return rng.weighted(spec.careers);
}

function makePosting(state: CompanyState, career: CareerId, index: number): Posting {
  const { spec, rng } = state;
  const cs = csOf(career);
  const kind = rng.weighted<EligKind>(
    HEAVY_CAREERS.has(career)
      ? [['none', 20], ['junior', 62], ['soph', 12], ['fresh', 2], ['multi', 4]]
      : [['none', 52], ['junior', 21], ['soph', 12], ['fresh', 10], ['multi', 5]],
  );
  const pick = makeTitle(rng, cs, kind, state.used, spec.prefer?.[career]);
  const title = pick.title;
  const normalizedTitle = normalizeTitle(title);
  const dept = rng.pick(cs.depts);

  const cities = pickCities(rng, spec, career);
  const locations = cities.map((c) => rng.pick(LOCATIONS[c]));
  const remote = cities.includes('remote');

  // dates
  const cat = categoryOf(career, spec.industry);
  const [lo, hi, exp] = CURRENT_WINDOW[cat];
  const offset = Math.min(74, lo + Math.floor((hi - lo + 1) * Math.pow(rng.next(), exp)));
  const firstSeen = addDays(FIRST_SEEN_START, offset);
  const earlier = offset >= 3 && rng.chance(0.15) ? rng.int(1, 3) : 0;
  const postedDay = addDays(firstSeen, -earlier);
  const postedAt = `${postedDay}T${pad2(rng.int(8, 21))}:${pad2(rng.int(0, 59))}:00.000Z`;
  let updatedAt = postedAt;
  if (rng.chance(0.3)) {
    const upd = clampIso(addDays(postedDay, rng.int(1, 10)), postedDay, TODAY);
    updatedAt = `${upd}T${pad2(upd === TODAY ? rng.int(5, 10) : rng.int(8, 21))}:${pad2(rng.int(0, 59))}:00.000Z`;
    if (updatedAt < postedAt) updatedAt = postedAt;
  }

  // compensation
  let compensation: Compensation | null = null;
  if (rng.chance(0.4)) {
    compensation = makeCompensation(rng, cs, spec.payBias ?? 0, rng.chance(0.5) ? 'field' : 'description');
  }

  // deadline
  let deadline: string | null = null;
  if (spec.earlyDeadlines !== undefined && index < spec.earlyDeadlines) {
    deadline = addDays(TODAY, rng.int(2, 5));
  } else if (rng.chance(0.1)) {
    deadline = addDays(TODAY, rng.int(2, 61));
  }

  // requirements + text
  const reqs = pickRequirements(rng, cs, spec);
  const elig = pickEligibility(rng, kind);
  const majorsText = reqs.majors.length > 0 ? majorList(rng, reqs.majors) : null;
  const paySentence =
    compensation && compensation.source === 'description'
      ? rng.pick([
          `The pay for this role is ${compensation.raw}.`,
          `Interns earn ${compensation.raw}.`,
          `Pay for this internship: ${compensation.raw}.`,
        ])
      : null;
  const deadlineSentence = deadline
    ? rng.pick([`Apply by ${longDate(deadline)}.`, `Apply by ${longDate(deadline)} to be considered for this class.`])
    : null;
  const weeks = rng.pick([8, 10, 10, 12]);
  const citiesText = listText([...new Set(locations.map(proseCity))]);

  const description = buildDescription(rng, {
    company: spec.name,
    blurb: spec.blurb,
    roleLabel: cs.roleLabel,
    team: teamName(career, pick.group, dept),
    citiesText,
    weeks,
    responsibilities: cs.responsibilities,
    elig,
    majorsText,
    minGpa: reqs.minGpa,
    required: reqs.required,
    preferred: reqs.preferred,
    paySentence,
    deadlineSentence,
  });

  const lowerTitle = title.toLowerCase();
  const keywordHit = lowerTitle.includes(cs.keyword);
  const classification: Classification = {
    industry: spec.industry,
    career,
    family: familyOf(career),
    method: 'rules',
    confidence: Math.min(0.99, Math.round((0.7 + rng.next() * 0.25 + (keywordHit ? 0.04 : 0)) * 100) / 100),
    evidence: [
      `department: ${dept}`,
      keywordHit ? `title mentions "${cs.keyword}"` : `role family: ${labelCareer(career)}`,
      `employer industry: ${labelIndustry(spec.industry)}`,
    ],
  };

  const extId = externalId(state);
  const id = `demo:${spec.slug}:${extId}`;
  return {
    id,
    source: 'demo',
    company: spec.name,
    companySlug: spec.slug,
    externalId: extId,
    title,
    normalizedTitle,
    department: dept,
    locations,
    cities,
    remote,
    postedAt,
    updatedAt,
    applyUrl: `/demo-posting/${id}`,
    description,
    compensation,
    firstSeen,
    lastSeen: TODAY,
    linkVerifiedAt: PULLED_AT,
    linkStatus: 'ok',
    isInternship: true,
    eligibility: {
      gradYears: elig.gradYears,
      phrases: elig.phrases,
      evidence: kind === 'none' ? null : elig.sentence,
    },
    classification,
    requirements: { required: reqs.required, preferred: reqs.preferred, minGpa: reqs.minGpa, majors: reqs.majors },
    deadline,
    cycle: CURRENT_CYCLE,
    dedupeKey: dedupeKey(spec.slug, normalizedTitle, CURRENT_CYCLE),
  };
}

// ---------------------------------------------------------------------------
// "New today" assignment
// ---------------------------------------------------------------------------

function markNewToday(rng: Rng, postings: Posting[]): void {
  const business = postings.filter((p) => p.classification.family === 'business');
  const chosen = new Set<string>();
  const countBy = (pred: (p: Posting) => boolean): number => business.filter((p) => chosen.has(p.id) && pred(p)).length;
  const ensure = (pred: (p: Posting) => boolean, want: number): void => {
    const candidates = rng.shuffle(business.filter((p) => pred(p) && !chosen.has(p.id)));
    for (const c of candidates) {
      if (countBy(pred) >= want) break;
      chosen.add(c.id);
    }
  };

  ensure((p) => p.cities.includes('atlanta') && p.classification.career === 'marketing', 6);
  ensure((p) => p.cities.includes('nyc') && p.classification.industry === 'finance', 6);
  ensure((p) => p.cities.includes('nyc') && p.classification.industry === 'consulting', 4);
  ensure((p) => p.cities.includes('remote') && p.classification.industry === 'finance', 4);
  ensure((p) => p.cities.includes('chicago') && p.classification.career === 'supply-chain', 4);
  for (const slug of ['northwind-capital', 'peachtree-brands', 'larkspur-consumer', 'magnolia-media']) {
    ensure((p) => p.companySlug === slug, 3);
  }
  ensure((p) => p.companySlug === 'halcyon-advisory', 1);

  const rest = rng.shuffle(business.filter((p) => !chosen.has(p.id)));
  for (const p of rest) {
    if (chosen.size >= TODAY_TARGET) break;
    chosen.add(p.id);
  }

  for (const p of postings) {
    if (!chosen.has(p.id)) continue;
    p.firstSeen = TODAY;
    const t = `${pad2(rng.int(5, 10))}:${pad2(rng.int(0, 59))}:00.000Z`;
    p.postedAt = `${TODAY}T${t}`;
    p.updatedAt = p.postedAt;
  }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

function lastTitle(title: string): string {
  return title.replaceAll('2027', '2026');
}

function historyRole(
  p: { slug: string; name: string; industry: IndustryId; career: CareerId },
  title: string,
  cycle: string,
  opened: string,
  closed: string | null,
  compensation: Compensation | null,
): HistoryRole {
  const normalizedTitle = normalizeTitle(title);
  return {
    dedupeKey: dedupeKey(p.slug, normalizedTitle, cycle),
    companySlug: p.slug,
    company: p.name,
    normalizedTitle,
    title,
    industry: p.industry,
    career: p.career,
    cycle,
    opened,
    closed,
    compensation,
  };
}

function lastCycleDates(rng: Rng, cat: Category, window?: [string, string]): { opened: string; closed: string } {
  const [wLo, wHi] = window ?? LAST_WINDOW[cat];
  let opened: string;
  if (window) {
    opened = isoOfDay(rng.int(dayNumber(wLo), dayNumber(wHi)));
  } else {
    const span = dayNumber(wHi) - dayNumber(wLo);
    opened = isoOfDay(dayNumber(wLo) + Math.floor((span + 1) * Math.pow(rng.next(), LAST_SKEW[cat])));
  }
  const [dLo, dHi] = LAST_DURATION[cat];
  let closed = addDays(opened, rng.int(dLo, dHi));
  if (closed > LAST_CYCLE_END) closed = LAST_CYCLE_END;
  if (closed <= opened) closed = addDays(opened, 1);
  return { opened, closed };
}

function buildRoles(
  rng: Rng,
  postings: Posting[],
  states: Map<string, CompanyState>,
  counts: Map<string, number>,
): HistoryRole[] {
  const roles: HistoryRole[] = [];

  // This cycle: one role per live posting.
  for (const p of postings) {
    const openedFromPost = p.postedAt ? p.postedAt.slice(0, 10) : p.firstSeen;
    roles.push(
      historyRole(
        { slug: p.companySlug, name: p.company, industry: p.classification.industry, career: p.classification.career },
        p.title,
        CURRENT_CYCLE,
        openedFromPost < p.firstSeen ? openedFromPost : p.firstSeen,
        null,
        p.compensation,
      ),
    );
  }

  // Last cycle: ~85% of current titles come back with last year's timing.
  for (const p of postings) {
    if (!rng.chance(0.85)) continue;
    const info = { slug: p.companySlug, name: p.company, industry: p.classification.industry, career: p.classification.career };
    const cat = categoryOf(info.career, info.industry);
    const { opened, closed } = lastCycleDates(rng, cat);
    roles.push(
      historyRole(info, lastTitle(p.title), LAST_CYCLE, opened, closed, p.compensation ? lowerCompensation(rng, p.compensation) : null),
    );
  }

  // Last-cycle-only roles that were not reposted this year, and companies with no current postings.
  for (const spec of COMPANIES) {
    const state = states.get(spec.slug);
    if (!state) continue;
    const current = counts.get(spec.slug) ?? 0;
    const hasWindow = spec.lastOpenWindow !== undefined;
    const extra = spec.noCurrent
      ? rng.int(10, 18)
      : spec.slug === 'halcyon-advisory'
        ? 6
        : Math.round(current * 0.08);

    const closedTitles: { pick: TitlePick; career: CareerId }[] = [];
    for (let i = 0; i < extra; i++) {
      const career: CareerId =
        spec.slug === 'halcyon-advisory' ? 'consulting' : pickCareerFromMix(rng, spec);
      const cs = csOf(career);
      const kind = rng.weighted<EligKind>([['none', 50], ['junior', 40], ['soph', 10]]);
      const pick = makeTitle(rng, cs, kind, state.used, spec.prefer?.[career]);
      const info = { slug: spec.slug, name: spec.name, industry: spec.industry, career };
      const cat = categoryOf(career, spec.industry);
      const { opened, closed } = lastCycleDates(rng, cat, hasWindow ? spec.lastOpenWindow : undefined);
      const comp = rng.chance(0.4) ? makeCompensation(rng, cs, (spec.payBias ?? 0) - 1, rng.chance(0.5) ? 'field' : 'description') : null;
      roles.push(historyRole(info, lastTitle(pick.title), LAST_CYCLE, opened, closed, comp));
      if (spec.closedThisCycle && closedTitles.length < spec.closedThisCycle) closedTitles.push({ pick, career });
    }

    // A company whose roles this year were already filled and closed.
    for (const ct of closedTitles) {
      const info = { slug: spec.slug, name: spec.name, industry: spec.industry, career: ct.career };
      const opened = addDays('2026-08-01', rng.int(2, 18));
      const closed = addDays('2026-09-05', rng.int(0, 24));
      const comp = rng.chance(0.4)
        ? makeCompensation(rng, csOf(ct.career), spec.payBias ?? 0, 'description')
        : null;
      roles.push(historyRole(info, ct.pick.title, CURRENT_CYCLE, opened, closed, comp));
    }
  }

  roles.sort(
    (a, b) =>
      a.companySlug.localeCompare(b.companySlug) ||
      a.cycle.localeCompare(b.cycle) ||
      a.normalizedTitle.localeCompare(b.normalizedTitle),
  );
  return roles;
}

function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = dayNumber(from); d <= dayNumber(to); d++) out.push(isoOfDay(d));
  return out;
}

function buildVolume(roles: HistoryRole[]): HistoryFile['volume'] {
  const dates = dateRange(TRACKING_SINCE, TODAY);
  const n = dates.length;
  const startDay = dayNumber(TRACKING_SINCE);
  const open = new Map<IndustryId, number[]>();
  const opened = new Map<IndustryId, number[]>();
  for (const ind of INDUSTRIES) {
    open.set(ind.id, new Array<number>(n + 1).fill(0));
    opened.set(ind.id, new Array<number>(n).fill(0));
  }
  for (const r of roles) {
    const openDiff = open.get(r.industry);
    const openedCounts = opened.get(r.industry);
    if (!openDiff || !openedCounts) continue;
    const s = Math.max(0, dayNumber(r.opened) - startDay);
    const eRaw = (r.closed ? dayNumber(r.closed) : dayNumber(TODAY)) - startDay;
    const e = Math.min(n - 1, eRaw);
    if (e < s) continue;
    openDiff[s] = (openDiff[s] ?? 0) + 1;
    openDiff[e + 1] = (openDiff[e + 1] ?? 0) - 1;
    const oi = dayNumber(r.opened) - startDay;
    if (oi >= 0 && oi < n) openedCounts[oi] = (openedCounts[oi] ?? 0) + 1;
  }
  const rows: HistoryFile['volume'] = [];
  const running = new Map<IndustryId, number>(INDUSTRIES.map((i) => [i.id, 0]));
  for (let i = 0; i < n; i++) {
    for (const ind of INDUSTRIES) {
      const diff = open.get(ind.id) as number[];
      const cur = (running.get(ind.id) ?? 0) + (diff[i] ?? 0);
      running.set(ind.id, cur);
      rows.push({
        date: dates[i] as string,
        industry: ind.id,
        open: cur,
        opened: (opened.get(ind.id) as number[])[i] ?? 0,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// generate()
// ---------------------------------------------------------------------------

export interface DemoDataset {
  latest: Snapshot;
  history: HistoryFile;
  index: { dates: string[]; latest: string; dataset: 'demo' };
}

export interface DemoOutput {
  demo: DemoDataset;
  demoZero: DemoDataset;
}

export function generate(): DemoOutput {
  const counts = allocateCounts();
  const states = new Map<string, CompanyState>();
  const postings: Posting[] = [];

  for (const spec of COMPANIES) {
    const state: CompanyState = {
      spec,
      rng: new Rng(SEED ^ hashString(spec.slug)),
      used: new Set<string>(),
      externalIds: new Set<string>(),
    };
    states.set(spec.slug, state);

    const n = counts.get(spec.slug) ?? 0;
    // Business postings, with the first ones of each company carrying early deadlines.
    for (let i = 0; i < n; i++) {
      const career = pickCareerFromMix(state.rng, spec);
      postings.push(makePosting(state, career, i));
    }
    // Non-business internships at technology employers.
    for (let i = 0; i < (spec.nonBusiness ?? 0); i++) {
      const career = state.rng.weighted<CareerId>([['software-engineering', 50], ['data-science', 25], ['design', 25]]);
      postings.push(makePosting(state, career, 1000 + i));
    }
  }

  const rng = new Rng(SEED ^ 0x9e3779b9);
  markNewToday(rng, postings);

  postings.sort((a, b) => (a.firstSeen === b.firstSeen ? a.id.localeCompare(b.id) : a.firstSeen < b.firstSeen ? 1 : -1));

  const roles = buildRoles(new Rng(SEED ^ 0x85ebca6b), postings, states, counts);

  const sources: SourceRunResult[] = COMPANIES.map((c): SourceRunResult => {
    const n = postings.filter((p) => p.companySlug === c.slug).length;
    return { companySlug: c.slug, source: 'demo', ok: true, fetched: n, kept: n, error: null };
  });

  const latest: Snapshot = {
    schemaVersion: 1,
    dataset: 'demo',
    pulledAt: PULLED_AT,
    date: TODAY,
    trackingSince: TRACKING_SINCE,
    sources,
    postings,
  };
  const history: HistoryFile = {
    schemaVersion: 1,
    dataset: 'demo',
    trackingSince: TRACKING_SINCE,
    builtAt: PULLED_AT,
    roles,
    volume: buildVolume(roles),
  };
  const index = { dates: [TODAY], latest: TODAY, dataset: 'demo' as const };

  // Zero-new-roles variant: everything first seen today moves to yesterday.
  const zeroPostings = structuredClone(postings);
  for (const p of zeroPostings) {
    if (p.firstSeen !== TODAY) continue;
    p.firstSeen = YESTERDAY;
    if (p.postedAt) p.postedAt = p.postedAt.replace(TODAY, YESTERDAY);
    if (p.updatedAt) p.updatedAt = p.updatedAt.replace(TODAY, YESTERDAY);
  }
  const zeroRoles = structuredClone(roles).map((r) =>
    r.cycle === CURRENT_CYCLE && r.opened === TODAY ? { ...r, opened: YESTERDAY } : r,
  );
  const demoZero: DemoDataset = {
    latest: { ...latest, postings: zeroPostings },
    history: { ...history, roles: zeroRoles, volume: buildVolume(zeroRoles) },
    index,
  };

  return { demo: { latest, history, index }, demoZero };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/** Relative output paths under public/data, and their exact file contents. */
export function renderFiles(out: DemoOutput): Record<string, string> {
  const ser = (v: unknown): string => `${JSON.stringify(v)}\n`;
  return {
    'demo/latest.json': ser(out.demo.latest),
    'demo/history.json': ser(out.demo.history),
    'demo/index.json': ser(out.demo.index),
    'demo-zero/latest.json': ser(out.demoZero.latest),
    'demo-zero/history.json': ser(out.demoZero.history),
    'demo-zero/index.json': ser(out.demoZero.index),
  };
}

export function hashFiles(files: Record<string, string>): string {
  const h = createHash('sha256');
  for (const k of Object.keys(files).sort()) {
    h.update(k);
    h.update('\0');
    h.update(files[k] as string);
    h.update('\0');
  }
  return h.digest('hex');
}

export { BUSINESS_CAREER_IDS };
