import type { ClassYear } from './types.ts';
import { CITY_PATTERNS } from './taxonomy.ts';

/**
 * Recruiting-cycle math.
 *
 * A cycle is named for the summer the internship happens in: "summer-2027".
 * Recruiting for summer Y runs during the academic year that ends in spring Y
 * (roughly Aug Y-1 through Jul Y).
 */

export const cycleId = (summerYear: number): string => `summer-${summerYear}`;

export function cycleYear(cycle: string): number {
  const m = /summer-(\d{4})/.exec(cycle);
  return m ? Number(m[1]) : NaN;
}

/** The summer an ISO date recruits for: Aug-Dec -> next summer, Jan-Jul -> this summer. */
export function summerForDate(iso: string): number {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  return d.getUTCMonth() >= 7 ? y + 1 : y;
}

/**
 * Infer the cycle for a posting: an explicit year in the title wins
 * ("Summer 2027 Analyst"), otherwise the date it was posted or first seen.
 */
export function inferCycle(title: string, dateIso: string): string {
  const m = /\b(20[2-3]\d)\b/.exec(title);
  if (m) return cycleId(Number(m[1]));
  return cycleId(summerForDate(dateIso));
}

const CLASS_OFFSET: Record<ClassYear, number> = { senior: 0, junior: 1, sophomore: 2, freshman: 3 };

/**
 * Graduation year of someone in `classYear` during the academic year that ends
 * in spring `springYear`. (Junior in 2026-27 -> spring 2027 -> graduates 2028.)
 */
export function gradYearFor(classYear: ClassYear, springYear: number): number {
  return springYear + CLASS_OFFSET[classYear];
}

/** Class year during the academic year ending `springYear`, or null if out of range. */
export function classYearFor(gradYear: number, springYear: number): ClassYear | null {
  const off = gradYear - springYear;
  const hit = (Object.keys(CLASS_OFFSET) as ClassYear[]).find((k) => CLASS_OFFSET[k] === off);
  return hit ?? null;
}

/** "Rising junior" for summer Y = a sophomore during the year ending Y. */
export function risingToGradYear(rising: ClassYear, summerYear: number): number | null {
  const now: Record<ClassYear, ClassYear | null> = {
    freshman: null,
    sophomore: 'freshman',
    junior: 'sophomore',
    senior: 'junior',
  };
  const cur = now[rising];
  return cur ? gradYearFor(cur, summerYear) : null;
}

/** The spring that ends the current academic year for a given date. */
export function currentSpring(iso: string): number {
  return summerForDate(iso);
}

// ---------- title normalization & dedupe ----------

const STRIP_WORDS = /\b(summer|fall|spring|winter|program|programme|position|opportunity|opening|role|paid|unpaid|full[- ]time|part[- ]time|hybrid|onsite|on[- ]site|in[- ]office)\b/g;

/**
 * Normalize a role title so reposts of the same role collapse to one key:
 * "Summer 2027 Investment Banking Analyst Internship - New York (Hybrid)"
 *   -> "investment banking analyst intern"
 */
export function normalizeTitle(title: string): string {
  let t = title.toLowerCase();
  t = t.replace(/\([^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ');
  // drop trailing " - City" / " | City" / ", City" segments that are locations
  const parts = t.split(/\s[-–—|]\s|,\s/);
  if (parts.length > 1) {
    t = parts
      .filter((p, i) => i === 0 || !isLocationish(p))
      .join(' ');
  }
  t = t.replace(/\b20[2-3]\d\b/g, ' ');
  t = t.replace(/\binternships?\b/g, 'intern').replace(/\binterns\b/g, 'intern');
  t = t.replace(/\bco-?op\b/g, 'coop');
  t = t.replace(STRIP_WORDS, ' ');
  t = t.replace(/[^a-z0-9& ]+/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function isLocationish(s: string): boolean {
  const x = s.trim().toLowerCase();
  if (/^(us|usa|united states|remote|hybrid|[a-z]{2})$/.test(x)) return true;
  return CITY_PATTERNS.some((c) => c.patterns.some((p) => p.test(x)));
}

export const dedupeKey = (companySlug: string, normalizedTitle: string, cycle: string): string =>
  `${companySlug}|${normalizedTitle}|${cycle}`;
