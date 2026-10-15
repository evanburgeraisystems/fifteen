import { daysBetween, fmtMonthDay } from '../core/windows.ts';

/** "today", "1d ago", "2d ago", "3w ago" */
export function ago(dateIso: string | null, nowIso: string): string {
  if (!dateIso) return '';
  const d = daysBetween(dateIso, nowIso);
  if (d <= 0) return 'today';
  if (d < 14) return `${d}d ago`;
  if (d < 60) return `${Math.round(d / 7)}w ago`;
  return fmtMonthDay(dateIso);
}

/** "Verified today" when the link resolved on today's pull, else the pull date. */
export function verifiedLabel(verifiedAt: string | null, nowIso: string): string {
  if (!verifiedAt) return 'Not verified';
  return verifiedAt.slice(0, 10) === nowIso.slice(0, 10) ? 'Verified today' : `Verified ${fmtMonthDay(verifiedAt)}`;
}

export const plural = (n: number, word: string, pluralWord = `${word}s`): string => `${n} ${n === 1 ? word : pluralWord}`;

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function weekdayLong(iso: string): string {
  return new Date(Date.parse(iso)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
