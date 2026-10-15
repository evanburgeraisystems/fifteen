import { describe, expect, it } from 'vitest';
import { composeNotification } from './notify.ts';
import { companyPay, hourly } from './pay.ts';
import { starEvents, unacknowledged } from './stars.ts';
import { predictCompanyWindow, seasonFor, zeroDaySentence } from './windows.ts';
import type { HistoryFile, HistoryRole, Posting } from './types.ts';

const TODAY = '2026-10-15T12:00:00.000Z';

function p(over: Partial<Posting>): Posting {
  return {
    id: 'x', source: 'demo', company: 'Halcyon', companySlug: 'halcyon', externalId: '1',
    title: 'Consulting Intern', normalizedTitle: 'consulting intern', department: null, locations: [], cities: ['nyc'],
    remote: false, postedAt: null, updatedAt: null, applyUrl: '/demo-posting/x', description: '', compensation: null,
    firstSeen: '2026-10-01', lastSeen: '2026-10-15', linkVerifiedAt: TODAY, linkStatus: 'ok', isInternship: true,
    eligibility: { gradYears: [], phrases: [], evidence: null },
    classification: { industry: 'consulting', career: 'consulting', family: 'business', method: 'rules', confidence: 1, evidence: [] },
    requirements: { required: [], preferred: [], minGpa: null, majors: [] }, deadline: null, cycle: 'summer-2027',
    dedupeKey: 'halcyon|consulting intern|summer-2027', ...over,
  };
}

function role(over: Partial<HistoryRole>): HistoryRole {
  return {
    dedupeKey: 'k', companySlug: 'halcyon', company: 'Halcyon', normalizedTitle: 'consulting intern', title: 'Consulting Intern',
    industry: 'consulting', career: 'consulting', cycle: 'summer-2026', opened: '2025-10-19', closed: '2025-12-01', compensation: null, ...over,
  };
}

function history(roles: HistoryRole[], volume: HistoryFile['volume'] = []): HistoryFile {
  return { schemaVersion: 1, dataset: 'demo', trackingSince: '2025-08-01', builtAt: TODAY, roles, volume };
}

describe('window prediction', () => {
  it('open now when roles are live', () => {
    const w = predictCompanyWindow('halcyon', [p({})], history([role({})]), TODAY);
    expect(w.status).toBe('open');
    expect(w.label).toBe('Open now');
  });
  it('predicts from last cycle and labels it', () => {
    const w = predictCompanyWindow('halcyon', [], history([role({}), role({ opened: '2025-10-25' })]), TODAY);
    expect(w.status).toBe('opening');
    expect(w.label).toBe('Opening ~Oct 19');
    expect(w.predictedOpen).toBe('2026-10-19');
    expect(w.basis).toContain('last year');
  });
  it('closed after last year’s window closed', () => {
    const w = predictCompanyWindow('halcyon', [], history([role({ opened: '2025-08-01', closed: '2025-09-01' })]), TODAY);
    expect(w.status).toBe('closed');
  });
  it('cold start says so instead of inventing a date', () => {
    const w = predictCompanyWindow('halcyon', [], history([]), TODAY);
    expect(w.status).toBe('unknown');
    expect(w.basis).toMatch(/Not enough history yet/);
    expect(w.predictedOpen).toBeNull();
  });
});

describe('season strip', () => {
  it('derives a per-industry phase from last cycle volume', () => {
    const volume: HistoryFile['volume'] = [];
    // 100 finance roles opened evenly Aug 1 - Oct 9 2025 (70 days).
    for (let i = 0; i < 70; i++) {
      const d = new Date(Date.UTC(2025, 7, 1 + i)).toISOString().slice(0, 10);
      volume.push({ date: d, industry: 'finance', open: 0, opened: i < 30 ? 2 : 1 });
    }
    const s = seasonFor('finance', history([], volume), [], TODAY);
    expect(s.coldStart).toBe(false);
    expect(s.phase).toBe('closed');
    expect(s.line).toMatch(/^Finance · Closed/);
    const early = seasonFor('finance', history([], volume), [], '2026-07-10T00:00:00Z');
    expect(early.phase).toBe('early');
    const peak = seasonFor('finance', history([], volume), [], '2026-08-25T00:00:00Z');
    expect(peak.phase).toBe('peak');
    expect(peak.line).toMatch(/Finance · Peak · week \d+ of \d+/);
  });
  it('cold start is labeled honestly', () => {
    const s = seasonFor('consulting', history([]), [p({})], TODAY);
    expect(s.coldStart).toBe(true);
    expect(s.line).toContain('tracking since');
  });
  it('zero-day sentence is calm and has season context', () => {
    const s = seasonFor('consulting', history([]), [], TODAY);
    expect(zeroDaySentence([s])).toMatch(/^No new roles today\. /);
  });
});

describe('star triggers', () => {
  const win = predictCompanyWindow('halcyon', [], history([role({})]), TODAY);
  it('fires for window opening within 7 days', () => {
    const ev = starEvents('halcyon', [], win, new Set(), TODAY);
    expect(ev.map((e) => e.kind)).toEqual(['window-soon']);
  });
  it('fires for a new role and a near deadline on an unapplied role', () => {
    const live = [p({ id: 'a', firstSeen: '2026-10-15' }), p({ id: 'b', deadline: '2026-10-18' })];
    const w = predictCompanyWindow('halcyon', live, null, TODAY);
    const ev = starEvents('halcyon', live, w, new Set(), TODAY);
    expect(ev.map((e) => e.kind).sort()).toEqual(['deadline', 'new-role']);
    const applied = starEvents('halcyon', live, w, new Set(['b']), TODAY);
    expect(applied.map((e) => e.kind)).toEqual(['new-role']);
  });
  it('clicking acknowledges; only newer events re-light the card', () => {
    const live = [p({ id: 'a', firstSeen: '2026-10-15' })];
    const w = predictCompanyWindow('halcyon', live, null, TODAY);
    const ev = starEvents('halcyon', live, w, new Set(), TODAY);
    const state = { starredAt: '2026-10-01T00:00:00Z', alerts: true, ackAt: null };
    expect(unacknowledged(ev, state)).toHaveLength(1);
    expect(unacknowledged(ev, { ...state, ackAt: '2026-10-15T13:00:00Z' })).toHaveLength(0);
    expect(unacknowledged(ev, { ...state, alerts: false })).toHaveLength(0);
  });
});

describe('pay', () => {
  it('normalizes units to hourly and rejects nonsense', () => {
    expect(hourly({ min: 25, max: 35, unit: 'hour', currency: 'USD', source: 'field', raw: '' })).toBe(30);
    expect(Math.round(hourly({ min: 8650, max: 8650, unit: 'month', currency: 'USD', source: 'field', raw: '' }) ?? 0)).toBe(50);
    expect(hourly({ min: 2, max: 3, unit: 'hour', currency: 'USD', source: 'field', raw: '' })).toBeNull();
  });
  it('prefers this cycle over last cycle per career', () => {
    const c = { min: 40, max: 50, unit: 'hour' as const, currency: 'USD', source: 'field' as const, raw: '' };
    const levels = companyPay('halcyon', [p({ compensation: c })], [role({ compensation: { ...c, min: 10, max: 12 } })]);
    expect(levels).toHaveLength(1);
    expect(levels[0]?.hourly).toBe(45);
    expect(levels[0]?.when).toBe('this cycle');
  });
});

describe('notifications', () => {
  const prefs = { newHits: true, starAlerts: true, weeklyDigest: false };
  it('never sends "0 new"', () => {
    expect(composeNotification(prefs, { newByTier: { perfect: 0, almost: 0, weak: 0 }, starCompanies: [], todayIso: TODAY })).toBeNull();
  });
  it('sends counts by tier when there are hits', () => {
    const n = composeNotification(prefs, { newByTier: { perfect: 2, almost: 3, weak: 0 }, starCompanies: [], todayIso: TODAY });
    expect(n?.body).toBe('2 Perfect · 3 Almost new today.');
    expect(n?.body).not.toMatch(/\b0\b/);
  });
  it('weekly digest only on its weekday and only with news', () => {
    const weekly = { ...prefs, weeklyDigest: true };
    expect(composeNotification(weekly, { newByTier: { perfect: 1, almost: 0, weak: 0 }, starCompanies: [], todayIso: '2026-10-15T00:00:00Z', weekNewTotal: 9 })).toBeNull();
    expect(composeNotification(weekly, { newByTier: { perfect: 1, almost: 0, weak: 0 }, starCompanies: [], todayIso: '2026-10-19T00:00:00Z', weekNewTotal: 9 })?.body).toContain('9 new roles');
    expect(composeNotification(weekly, { newByTier: { perfect: 0, almost: 0, weak: 0 }, starCompanies: [], todayIso: '2026-10-19T00:00:00Z', weekNewTotal: 0 })).toBeNull();
  });
});

describe('star trigger for unposted role groups', () => {
  it('fires when a company is open but last year’s consulting roles are not posted yet', () => {
    const live = [p({ id: 'live', title: 'Strategy Intern', normalizedTitle: 'strategy intern', classification: { industry: 'consulting', career: 'strategy', family: 'business', method: 'rules', confidence: 1, evidence: [] } })];
    const w = predictCompanyWindow('halcyon', live, null, TODAY);
    expect(w.status).toBe('open');
    const ev = starEvents('halcyon', live, w, new Set(), TODAY, [role({ opened: '2025-10-19' }), role({ opened: '2025-06-01', normalizedTitle: 'old' })]);
    const soon = ev.filter((e) => e.kind === 'window-soon');
    expect(soon).toHaveLength(1);
    expect(soon[0]?.text).toBe('Consulting roles likely open ~Oct 19');
  });
});
