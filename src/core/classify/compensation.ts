/** US pay-transparency text -> Compensation. */
import type { Compensation } from '../types.ts';

type Unit = Compensation['unit'];

const AMT = String.raw`(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(k\b)?`;
const RANGE_RE = new RegExp(String.raw`\$\s?${AMT}\s*(?:-|–|—|to|and)\s*\$?\s?${AMT}`, 'gi');
const SINGLE_RE = new RegExp(String.raw`\$\s?${AMT}`, 'gi');

const UNIT_AFTER =
  /^\s*[(,]?\s*(?:usd|us\$|dollars?)?\s*(?:\/|per\s+|an?\s+|each\s+)\s*(hour|hr|h|week|wk|month|mo|year|yr|annum)\b|^\s*[(,]?\s*(?:usd\s*)?(hourly|weekly|monthly|annually|annual|yearly|per annum|p\.a\.)/i;

const PLAUSIBLE: Record<Unit, [number, number]> = {
  hour: [7, 300],
  week: [100, 10000],
  month: [500, 30000],
  year: [10000, 500000],
};

const NON_PAY_BEFORE =
  /\b(relocation|relocating|moving|housing|tuition|sign[- ]?on|signing|referral|bonus|reimburs\w*|per diem|allowance|raised|valuation|funding|revenue|assets|aum|donat\w*|gift|loan|401|matching|match|scholarship|stipend for (?:housing|travel))\b/i;
const NON_PAY_AFTER =
  /^\s*(?:(?:per\s+(?:month|week|year)|monthly|annually|\/mo)\s*)?(?:in\s+|of\s+)?(?:assets|aum|revenue|funding|tuition|relocation|housing|moving|travel|meal|commuter|wellness|learning|sales|capital|arr\b|valuation|market cap|equity|stock|bonus|reimburs\w*|allowance)/i;
const SCALE_AFTER = /^\s*(?:k\b)?\s*(?:b|bn|billion|m|mm|million|trillion|t)\b(?![a-z])/i;

function parseAmount(whole: string, frac: string | undefined, k: string | undefined): number {
  const n = Number(`${whole.replace(/,/g, '')}${frac ? `.${frac}` : ''}`);
  return k ? n * 1000 : n;
}

function unitFromBefore(before: string): Unit | null {
  const b = before.toLowerCase();
  if (/\bhourly\b/.test(b)) return 'hour';
  if (/\bweekly\b/.test(b)) return 'week';
  if (/\bmonthly\b/.test(b)) return 'month';
  if (/\b(annual|annualized|yearly|salary|base pay|base salary)\b/.test(b)) return 'year';
  return null;
}

function unitWord(w: string): Unit {
  const x = w.toLowerCase();
  if (x === 'hour' || x === 'hr' || x === 'h' || x === 'hourly') return 'hour';
  if (x === 'week' || x === 'wk' || x === 'weekly') return 'week';
  if (x === 'month' || x === 'mo' || x === 'monthly') return 'month';
  return 'year';
}

function clauseBefore(text: string, index: number): string {
  const start = Math.max(0, index - 70);
  const raw = text.slice(start, index);
  // Keep only the current clause; sentence breaks reset the context.
  const cut = Math.max(raw.lastIndexOf('. '), raw.lastIndexOf('\n'), raw.lastIndexOf('; '));
  return cut >= 0 ? raw.slice(cut + 1) : raw;
}

interface Candidate {
  index: number;
  end: number;
  min: number;
  max: number;
  isRange: boolean;
}

function candidates(text: string): Candidate[] {
  const out: Candidate[] = [];
  const consumed: [number, number][] = [];

  for (const m of text.matchAll(RANGE_RE)) {
    const hasKFirst = !!m[3];
    const hasKSecond = !!m[6];
    let lo = parseAmount(m[1] ?? '0', m[2], m[3]);
    const hi = parseAmount(m[4] ?? '0', m[5], m[6]);
    if (hasKSecond && !hasKFirst && lo < 1000) lo *= 1000;
    if (hi < lo) continue;
    out.push({ index: m.index, end: m.index + m[0].length, min: lo, max: hi, isRange: true });
    consumed.push([m.index, m.index + m[0].length]);
  }
  for (const m of text.matchAll(SINGLE_RE)) {
    if (consumed.some(([a, b]) => m.index >= a && m.index < b)) continue;
    const v = parseAmount(m[1] ?? '0', m[2], m[3]);
    out.push({ index: m.index, end: m.index + m[0].length, min: v, max: v, isRange: false });
  }
  return out.sort((a, b) => a.index - b.index);
}

export function extractCompensationFromText(description: string): Compensation | null {
  const text = description.replaceAll(String.fromCharCode(160), ' ');
  for (const c of candidates(text)) {
    const afterAll = text.slice(c.end);
    const before = clauseBefore(text, c.index);

    if (SCALE_AFTER.test(afterAll) && !/^\s*k\b/i.test(afterAll)) continue; // "$10B in assets", "$5 million"
    if (NON_PAY_BEFORE.test(before)) continue;

    const unitMatch = UNIT_AFTER.exec(afterAll);
    let unit: Unit | null;
    let rawEnd = c.end;
    if (unitMatch) {
      unit = unitWord(unitMatch[1] ?? unitMatch[2] ?? '');
      rawEnd = c.end + unitMatch[0].length;
    } else {
      if (NON_PAY_AFTER.test(afterAll)) continue;
      unit = unitFromBefore(before);
      if (!unit && c.min >= 20000 && /\b(salary|compensation|pay|range|base|wage)\b/i.test(before)) unit = 'year';
    }
    if (!unit) continue;
    // "$500 monthly housing stipend" - a unit followed by a non-pay noun
    if (unitMatch && NON_PAY_AFTER.test(afterAll.slice(unitMatch[0].length))) continue;

    const [lo, hi] = PLAUSIBLE[unit];
    if (c.min < lo || c.max > hi) continue;

    const raw = text.slice(c.index, rawEnd).replace(/\s+/g, ' ').trim();
    return { min: c.min, max: c.max, unit, currency: 'USD', source: 'description', raw };
  }
  return null;
}
