import type { EmailKind, TrackerStage } from '../types.ts';

/** The tracker column an email kind moves a card to (null = leave the tracker alone). */
export function stageForEmail(kind: EmailKind): TrackerStage | null {
  switch (kind) {
    case 'applied-confirmation':
      return 'applied';
    case 'assessment':
      return 'assessment';
    case 'interview':
      return 'interview';
    case 'offer':
      return 'offer';
    case 'rejection':
      return 'denied';
    case 'other':
      return null;
  }
}

const RANK: Record<Exclude<TrackerStage, 'denied'>, number> = {
  applied: 0,
  assessment: 1,
  interview: 2,
  offer: 3,
};

/**
 * Should an email-driven move from `current` to `next` happen?
 *  - never move backwards (a late "thanks for applying" must not undo an interview);
 *  - 'denied' is always reachable, except from a terminal card;
 *  - 'offer' and 'denied' are terminal: only the user can drag them out.
 */
export function shouldMove(current: TrackerStage | null, next: TrackerStage): boolean {
  if (current === null) return true;
  if (current === next) return false;
  if (current === 'offer' || current === 'denied') return false;
  if (next === 'denied') return true;
  return RANK[next] > RANK[current];
}
