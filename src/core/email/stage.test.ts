import { describe, expect, it } from 'vitest';
import type { EmailKind, TrackerStage } from '../types.ts';
import { shouldMove, stageForEmail } from './stage.ts';

describe('stageForEmail', () => {
  it('maps every email kind', () => {
    const table: [EmailKind, TrackerStage | null][] = [
      ['applied-confirmation', 'applied'],
      ['assessment', 'assessment'],
      ['interview', 'interview'],
      ['offer', 'offer'],
      ['rejection', 'denied'],
      ['other', null],
    ];
    for (const [kind, stage] of table) expect(stageForEmail(kind), kind).toBe(stage);
  });
});

describe('shouldMove', () => {
  it('moves forward through the pipeline', () => {
    expect(shouldMove(null, 'applied')).toBe(true);
    expect(shouldMove('applied', 'assessment')).toBe(true);
    expect(shouldMove('applied', 'interview')).toBe(true);
    expect(shouldMove('assessment', 'interview')).toBe(true);
    expect(shouldMove('interview', 'offer')).toBe(true);
    expect(shouldMove('applied', 'offer')).toBe(true);
  });

  it('never moves backwards or sideways', () => {
    expect(shouldMove('interview', 'applied')).toBe(false);
    expect(shouldMove('interview', 'assessment')).toBe(false);
    expect(shouldMove('assessment', 'applied')).toBe(false);
    expect(shouldMove('applied', 'applied')).toBe(false);
    expect(shouldMove('interview', 'interview')).toBe(false);
  });

  it('denied is reachable from every active stage', () => {
    for (const from of [null, 'applied', 'assessment', 'interview'] as const) {
      expect(shouldMove(from, 'denied'), String(from)).toBe(true);
    }
  });

  it('offer and denied are terminal: only the user can drag them out', () => {
    for (const next of ['applied', 'assessment', 'interview', 'offer', 'denied'] as const) {
      expect(shouldMove('offer', next), `offer->${next}`).toBe(false);
      expect(shouldMove('denied', next), `denied->${next}`).toBe(false);
    }
  });
});
