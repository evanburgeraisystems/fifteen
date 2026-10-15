/**
 * Window prediction and season phases, from snapshot history.
 * Everything here labels its confidence honestly; with no prior cycle the
 * answer is "Not enough history yet", never an invented date.
 */
import { cycleId, summerForDate } from './cycle.ts';
import { labelIndustry } from './taxonomy.ts';
import type { HistoryFile, HistoryRole, IndustryId, Posting } from './types.ts';

const DAY = 86_400_000;

export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number): string => isoDate(new Date(Date.parse(iso.slice(0, 10)) + n * DAY));
export const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / DAY);
/** Same calendar day one year later (Feb 29 -> Mar 1). */
export const plusYear = (iso: string): string => {
  const d = new Date(Date.parse(iso.slice(0, 10)));
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return isoDate(d);
};

export function fmtMonthDay(iso: string): string {
  return new Date(Date.parse(iso.slice(0, 10))).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function fmtMonthYear(iso: string): string {
  return new Date(Date.parse(iso.slice(0, 10))).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface CompanyWindow {
  status: 'open' | 'opening' | 'late' | 'closed' | 'unknown';
  /** Short label for the card: "Open now", "Opening ~Aug 12", "Closed". */
  label: string;
  openCount: number;
  predictedOpen: string | null;
  confidence: Confidence;
  /** Plain explanation: "Opened ~Aug 12 last year (4 roles)". */
  basis: string;
  lastCycle: { opened: string; closed: string | null; roles: number } | null;
}

export function previousCycle(todayIso: string): string {
  return cycleId(summerForDate(todayIso) - 1);
}

export function currentCycle(todayIso: string): string {
  return cycleId(summerForDate(todayIso));
}

function confidenceFor(n: number): Confidence {
  // One prior cycle is all anyone has at first, so confidence tops out at medium.
  return n >= 5 ? 'medium' : 'low';
}

export function companyRolesByCycle(history: HistoryFile | null, slug: string, cycle: string): HistoryRole[] {
  if (!history) return [];
  return history.roles.filter((r) => r.companySlug === slug && r.cycle === cycle);
}

export function predictCompanyWindow(
  slug: string,
  live: Posting[],
  history: HistoryFile | null,
  todayIso: string,
): CompanyWindow {
  const openNow = live.filter((p) => p.companySlug === slug);
  const last = companyRolesByCycle(history, slug, previousCycle(todayIso));
  const lastCycle =
    last.length > 0
      ? {
          opened: last.map((r) => r.opened).sort()[0] ?? '',
          closed: last.some((r) => r.closed == null) ? null : (last.map((r) => r.closed ?? '').sort().at(-1) ?? null),
          roles: last.length,
        }
      : null;

  if (openNow.length > 0) {
    return {
      status: 'open',
      label: 'Open now',
      openCount: openNow.length,
      predictedOpen: null,
      confidence: 'high',
      basis: `${openNow.length} role${openNow.length === 1 ? '' : 's'} live on the latest pull`,
      lastCycle,
    };
  }
  if (!lastCycle) {
    const since = history ? fmtMonthYear(history.trackingSince) : null;
    return {
      status: 'unknown',
      label: 'No roles posted',
      openCount: 0,
      predictedOpen: null,
      confidence: 'none',
      basis: since ? `Not enough history yet · tracking since ${since}` : 'Not enough history yet',
      lastCycle: null,
    };
  }
  const predicted = plusYear(lastCycle.opened);
  const conf = confidenceFor(lastCycle.roles);
  const lastLabel = `Opened ~${fmtMonthDay(lastCycle.opened)} last year`;
  if (predicted > todayIso.slice(0, 10)) {
    return {
      status: 'opening',
      label: `Opening ~${fmtMonthDay(predicted)}`,
      openCount: 0,
      predictedOpen: predicted,
      confidence: conf,
      basis: `${lastLabel} (${lastCycle.roles} role${lastCycle.roles === 1 ? '' : 's'}); one prior cycle, so treat as a rough guide`,
      lastCycle,
    };
  }
  // Predicted date has passed and nothing is live.
  const lastClosed = lastCycle.closed ? plusYear(lastCycle.closed) : null;
  if (lastClosed && lastClosed < todayIso.slice(0, 10)) {
    return {
      status: 'closed',
      label: 'Closed',
      openCount: 0,
      predictedOpen: plusYear(predicted),
      confidence: conf,
      basis: `${lastLabel}; closed ~${fmtMonthDay(lastCycle.closed ?? '')}`,
      lastCycle,
    };
  }
  return {
    status: 'late',
    label: `Expected ~${fmtMonthDay(predicted)}`,
    openCount: 0,
    predictedOpen: predicted,
    confidence: conf,
    basis: `${lastLabel}; nothing posted yet this year`,
    lastCycle,
  };
}

/** "Opened ~Aug 12 last year" for one role title at a company, or null. */
export function roleLastCycle(history: HistoryFile | null, slug: string, normalizedTitle: string, todayIso: string): HistoryRole | null {
  const last = companyRolesByCycle(history, slug, previousCycle(todayIso));
  return last.find((r) => r.normalizedTitle === normalizedTitle) ?? null;
}

// ---------- season strip ----------

export type Phase = 'early' | 'opening' | 'peak' | 'late' | 'closed';

export interface Season {
  industry: IndustryId;
  phase: Phase | null;
  /** "Peak", "Opening", ... */
  phaseLabel: string;
  week: number | null;
  weeks: number | null;
  /** For "opens in about 3 weeks". */
  weeksUntilOpen: number | null;
  openNow: number;
  /** One-line strip text: "Finance · Peak · week 3 of 8". */
  line: string;
  /** Sentence for zero-roles days: "Finance windows are mostly closed." */
  sentence: string;
  coldStart: boolean;
}

const PHASE_LABEL: Record<Phase, string> = {
  early: 'Before season',
  opening: 'Opening',
  peak: 'Peak',
  late: 'Late',
  closed: 'Closed',
};

/**
 * Phase of an industry's season, from last cycle's posting volume:
 * cumulative share of roles opened on the same day last year.
 *   <10%  early   | 10-30% opening | 30-75% peak | 75-95% late | >95% closed
 */
export function seasonFor(industry: IndustryId, history: HistoryFile | null, live: Posting[], todayIso: string): Season {
  const name = labelIndustry(industry);
  const openNow = live.filter((p) => p.classification.industry === industry).length;
  const today = todayIso.slice(0, 10);
  // The recruiting season for summer S runs Jul 1 (S-1) .. Jun 30 S; compare with the one before it.
  const d = new Date(Date.parse(today));
  const seasonSummer = d.getUTCMonth() >= 6 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
  const prevYear = seasonSummer - 1;

  const rows = (history?.volume ?? []).filter((v) => v.industry === industry);
  // Last cycle window: Jul 1 of (prevYear-1) .. Jun 30 of prevYear.
  const start = `${prevYear - 1}-07-01`;
  const end = `${prevYear}-06-30`;
  const lastCycleRows = rows.filter((r) => r.date >= start && r.date <= end).sort((a, b) => (a.date < b.date ? -1 : 1));
  const total = lastCycleRows.reduce((n, r) => n + r.opened, 0);

  if (!history || total < 5) {
    const since = history ? fmtMonthYear(history.trackingSince) : fmtMonthYear(today);
    return {
      industry,
      phase: null,
      phaseLabel: 'Not enough history yet',
      week: null,
      weeks: null,
      weeksUntilOpen: null,
      openNow,
      line: `${name} · ${openNow} open · tracking since ${since}`,
      sentence: `${name} has ${openNow} open role${openNow === 1 ? '' : 's'}; we don’t have a full season of history yet.`,
      coldStart: true,
    };
  }

  // Date (last year) at which cumulative share crosses each threshold.
  const crossing = (share: number): string => {
    let acc = 0;
    for (const r of lastCycleRows) {
      acc += r.opened;
      if (acc / total >= share) return r.date;
    }
    return lastCycleRows.at(-1)?.date ?? end;
  };
  const t10 = plusYear(crossing(0.1));
  const t30 = plusYear(crossing(0.3));
  const t75 = plusYear(crossing(0.75));
  const t95 = plusYear(crossing(0.95));

  let phase: Phase;
  let from: string;
  let to: string;
  if (today < t10) {
    phase = 'early';
    from = today;
    to = t10;
  } else if (today < t30) {
    phase = 'opening';
    from = t10;
    to = t30;
  } else if (today < t75) {
    phase = 'peak';
    from = t30;
    to = t75;
  } else if (today < t95) {
    phase = 'late';
    from = t75;
    to = t95;
  } else {
    phase = 'closed';
    from = t95;
    to = t95;
  }
  const weeks = Math.max(1, Math.ceil(daysBetween(from, to) / 7));
  const week = Math.min(weeks, Math.max(1, Math.floor(daysBetween(from, today) / 7) + 1));
  const weeksUntilOpen = phase === 'early' ? Math.max(1, Math.round(daysBetween(today, t10) / 7)) : null;

  let line: string;
  let sentence: string;
  switch (phase) {
    case 'early':
      line = `${name} · Opens in ~${weeksUntilOpen} wk`;
      sentence = `${name} opens in about ${weeksUntilOpen} week${weeksUntilOpen === 1 ? '' : 's'}.`;
      break;
    case 'closed':
      line = `${name} · Closed · reopens ~${fmtMonthDay(plusYear(t10))}`;
      sentence = `${name} windows are mostly closed.`;
      break;
    case 'late':
      line = `${name} · Late · week ${week} of ${weeks}`;
      sentence = `${name} is late in its season; most windows have closed.`;
      break;
    default:
      line = `${name} · ${PHASE_LABEL[phase]} · week ${week} of ${weeks}`;
      sentence = `${name} is in its ${PHASE_LABEL[phase].toLowerCase()} weeks.`;
  }
  return {
    industry,
    phase,
    phaseLabel: PHASE_LABEL[phase],
    week: phase === 'early' || phase === 'closed' ? null : week,
    weeks: phase === 'early' || phase === 'closed' ? null : weeks,
    weeksUntilOpen,
    openNow,
    line,
    sentence,
    coldStart: false,
  };
}

/**
 * Calm zero-roles sentence across the student's industries:
 * "No new roles today. Finance windows are mostly closed; Consulting opens in about 3 weeks."
 */
export function zeroDaySentence(seasons: Season[]): string {
  const parts = seasons.slice(0, 3).map((s) => s.sentence.replace(/\.$/, ''));
  return parts.length ? `No new roles today. ${parts.join('; ')}.` : 'No new roles today.';
}
