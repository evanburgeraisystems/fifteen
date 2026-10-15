/**
 * New Stars triggers. A starred company glows on the next visit when something
 * new happened there since the student last clicked its card:
 *   - a new role was posted
 *   - its window is predicted to open within ~7 days
 *   - a deadline is approaching on a role they haven't applied to
 * Clicking the card acknowledges everything up to now; only a later event re-lights it.
 */
import { addDays, daysBetween, fmtMonthDay, type CompanyWindow } from './windows.ts';
import type { Posting } from './types.ts';

export type StarEventKind = 'new-role' | 'window-soon' | 'deadline';

export interface StarEvent {
  kind: StarEventKind;
  /** When the event became true (ISO date). Events at or before the ack date are cleared. */
  at: string;
  text: string;
  postingId?: string;
}

export interface StarState {
  starredAt: string;
  alerts: boolean;
  /** ISO date-time of the last click on the card. */
  ackAt: string | null;
}

export function starEvents(
  slug: string,
  live: Posting[],
  window: CompanyWindow,
  appliedIds: Set<string>,
  todayIso: string,
): StarEvent[] {
  const today = todayIso.slice(0, 10);
  const events: StarEvent[] = [];
  const mine = live.filter((p) => p.companySlug === slug);

  const fresh = mine.filter((p) => p.firstSeen === today || daysBetween(p.firstSeen, today) <= 1);
  for (const p of fresh) {
    events.push({ kind: 'new-role', at: p.firstSeen, text: `New: ${p.title}`, postingId: p.id });
  }

  if (window.status === 'opening' && window.predictedOpen) {
    const d = daysBetween(today, window.predictedOpen);
    if (d >= 0 && d <= 7) {
      events.push({
        kind: 'window-soon',
        at: addDays(window.predictedOpen, -7),
        text: `Window likely opens ~${fmtMonthDay(window.predictedOpen)}`,
      });
    }
  }

  for (const p of mine) {
    if (!p.deadline || appliedIds.has(p.id)) continue;
    const d = daysBetween(today, p.deadline);
    if (d >= 0 && d <= 7) {
      events.push({
        kind: 'deadline',
        at: addDays(p.deadline, -7),
        text: `Apply by ${fmtMonthDay(p.deadline)}: ${p.title}`,
        postingId: p.id,
      });
    }
  }
  return events;
}

/** Events that should make the card glow (newer than the last acknowledgement). */
export function unacknowledged(events: StarEvent[], state: StarState): StarEvent[] {
  if (!state.alerts) return [];
  const ack = state.ackAt?.slice(0, 10) ?? null;
  const starred = state.starredAt.slice(0, 10);
  return events.filter((e) => {
    // An event older than the star itself still counts on the first visit after starring,
    // except stale new-role events from before the student starred the company.
    if (e.kind === 'new-role' && e.at < starred) return false;
    return ack == null || e.at > ack;
  });
}
