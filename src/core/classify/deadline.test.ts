import { describe, expect, it } from 'vitest';
import { extractDeadline } from './index.ts';

const REF = '2026-10-15';

describe('extractDeadline', () => {
  it('reads "apply by November 1" and infers the year', () => {
    expect(extractDeadline('Please apply by November 1 to be considered.', REF)).toBe('2026-11-01');
  });

  it('reads a numeric date after "applications close"', () => {
    expect(extractDeadline('Applications close 11/01/2026 at 11:59pm ET.', REF)).toBe('2026-11-01');
  });

  it('reads "deadline: Oct 31, 2026"', () => {
    expect(extractDeadline('Application deadline: Oct 31, 2026', REF)).toBe('2026-10-31');
  });

  it('reads "submit your application before December 1st"', () => {
    expect(extractDeadline('Submit your application before December 1st.', REF)).toBe('2026-12-01');
  });

  it('reads day-first and ISO dates', () => {
    expect(extractDeadline('Applications are due by 15 November 2026.', REF)).toBe('2026-11-15');
    expect(extractDeadline('Closing date: 2026-11-15', REF)).toBe('2026-11-15');
  });

  it('reads "submit by" and "accepted until"', () => {
    expect(extractDeadline('Submit by 10/31 to be considered.', REF)).toBe('2026-10-31');
    expect(extractDeadline('Applications will be accepted until Nov. 15, 2026.', REF)).toBe('2026-11-15');
  });

  it('reads a numeric date without a year', () => {
    expect(extractDeadline('Apply by 11/15 for priority review.', REF)).toBe('2026-11-15');
  });

  it('rolls a past month/day into next year, with a 30-day grace window', () => {
    expect(extractDeadline('Apply by January 15.', '2026-12-20')).toBe('2027-01-15');
    expect(extractDeadline('Apply by March 3.', REF)).toBe('2027-03-03');
    expect(extractDeadline('Apply by October 1.', REF)).toBe('2026-10-01'); // closed two weeks ago, still this cycle
  });

  it('returns null when no deadline is stated', () => {
    expect(extractDeadline('We review applications on a rolling basis.', REF)).toBeNull();
    expect(extractDeadline('The internship starts June 1, 2027 and runs ten weeks.', REF)).toBeNull();
  });

  it('does not take a start date that follows an unspecific deadline sentence', () => {
    expect(extractDeadline('Deadline to apply is rolling; start date June 1.', REF)).toBeNull();
  });

  it('rejects impossible dates', () => {
    expect(extractDeadline('Apply by 13/45/2026.', REF)).toBeNull();
  });

  it('returns null for an unparseable reference date', () => {
    expect(extractDeadline('Apply by November 1.', 'not-a-date')).toBeNull();
  });
});
