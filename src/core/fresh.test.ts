import { describe, expect, it } from 'vitest';
import { isFreshOnPull } from './fresh.ts';

describe('isFreshOnPull', () => {
  it('after the first day, new = first seen on the latest pull', () => {
    expect(isFreshOnPull({ firstSeen: '2026-10-15', postedAt: '2026-01-01T00:00:00Z' }, '2026-10-15', '2026-09-01')).toBe(true);
    expect(isFreshOnPull({ firstSeen: '2026-10-14', postedAt: null }, '2026-10-15', '2026-09-01')).toBe(false);
  });
  it('on the first day of tracking, only roles the employer posted in the last day are new', () => {
    expect(isFreshOnPull({ firstSeen: '2026-10-15', postedAt: '2026-10-14T18:00:00Z' }, '2026-10-15', '2026-10-15')).toBe(true);
    expect(isFreshOnPull({ firstSeen: '2026-10-15', postedAt: '2026-10-01T00:00:00Z' }, '2026-10-15', '2026-10-15')).toBe(false);
    expect(isFreshOnPull({ firstSeen: '2026-10-15', postedAt: null }, '2026-10-15', '2026-10-15')).toBe(false);
  });
});
