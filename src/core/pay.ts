/**
 * Approximate intern pay, from posting compensation fields and pay-transparency
 * text. Always shown as "~" with its source. Full-time levels come later from
 * U.S. Department of Labor H-1B wage disclosures; until then we say so.
 */
import { labelCareer } from './taxonomy.ts';
import type { CareerId, Compensation, HistoryRole, Posting } from './types.ts';

export const HOURS_PER_YEAR = 2080;
const HOURS: Record<Compensation['unit'], number> = { hour: 1, week: 40, month: 173, year: HOURS_PER_YEAR };

/** Midpoint hourly rate in USD, or null if unusable. */
export function hourly(c: Compensation | null): number | null {
  if (!c || c.currency.toUpperCase() !== 'USD') return null;
  const lo = c.min ?? c.max;
  const hi = c.max ?? c.min;
  if (lo == null || hi == null) return null;
  const mid = (lo + hi) / 2 / HOURS[c.unit];
  // Sanity band for US internships: $8-$150/hr.
  return mid >= 8 && mid <= 150 ? mid : null;
}

export const fmtHourly = (n: number): string => `~$${Math.round(n)}/hr`;

export function fmtComp(c: Compensation): string {
  const unit = { hour: 'hr', week: 'wk', month: 'mo', year: 'yr' }[c.unit];
  const f = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);
  if (c.min != null && c.max != null && c.min !== c.max) return `~${f(c.min)}–${f(c.max)}/${unit}`;
  const v = c.min ?? c.max;
  return v != null ? `~${f(v)}/${unit}` : '';
}

export interface PayLevel {
  career: CareerId;
  label: string;
  /** Median hourly across postings. */
  hourly: number;
  low: number;
  high: number;
  samples: number;
  sources: ('field' | 'description')[];
  /** "this cycle" or "last cycle" */
  when: 'this cycle' | 'last cycle';
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
}

/** Intern pay per career at one company: this cycle's postings, falling back to last cycle's history. */
export function companyPay(slug: string, live: Posting[], lastCycle: HistoryRole[]): PayLevel[] {
  const by = new Map<CareerId, { rates: number[]; sources: Set<'field' | 'description'>; when: PayLevel['when'] }>();
  const add = (career: CareerId, c: Compensation | null, when: PayLevel['when']) => {
    const h = hourly(c);
    if (h == null || !c) return;
    const cur = by.get(career);
    if (cur && cur.when === 'this cycle' && when === 'last cycle') return;
    const entry = cur && cur.when === when ? cur : { rates: [], sources: new Set<'field' | 'description'>(), when };
    entry.rates.push(h);
    entry.sources.add(c.source);
    by.set(career, entry);
  };
  for (const p of live) if (p.companySlug === slug) add(p.classification.career, p.compensation, 'this cycle');
  for (const r of lastCycle) if (r.companySlug === slug) add(r.career, r.compensation, 'last cycle');
  return [...by.entries()]
    .map(([career, v]) => ({
      career,
      label: labelCareer(career),
      hourly: median(v.rates),
      low: Math.min(...v.rates),
      high: Math.max(...v.rates),
      samples: v.rates.length,
      sources: [...v.sources],
      when: v.when,
    }))
    .sort((a, b) => b.hourly - a.hourly);
}

export const FULL_TIME_PAY_NOTE =
  'Full-time pay by level is coming later, from U.S. Department of Labor H-1B wage disclosures.';
