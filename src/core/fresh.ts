/**
 * "New today" means the role appeared on the latest pull. On the first day we
 * track a source, every role is first seen that day, so we fall back to the
 * employer's own posted date instead of calling everything new.
 */
import type { Posting } from './types.ts';

export function isFreshOnPull(p: Pick<Posting, 'firstSeen' | 'postedAt'>, pullDate: string, trackingSince: string): boolean {
  if (p.firstSeen !== pullDate) return false;
  if (pullDate !== trackingSince) return true;
  if (!p.postedAt) return false;
  const days = (Date.parse(pullDate) - Date.parse(p.postedAt.slice(0, 10))) / 86_400_000;
  return days <= 1;
}
