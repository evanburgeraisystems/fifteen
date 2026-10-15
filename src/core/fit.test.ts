import { describe, expect, it } from 'vitest';
import { profileSignals, rankPostings, scoreFit } from './fit.ts';
import { SIGNALS } from './signals.ts';
import type { Posting, Profile, Targets } from './types.ts';

const NOW = '2026-10-15T12:00:00.000Z';

function posting(over: Partial<Posting> = {}): Posting {
  return {
    id: 'demo:acme:1',
    source: 'demo',
    company: 'Acme',
    companySlug: 'acme',
    externalId: '1',
    title: 'Investment Banking Summer Analyst',
    normalizedTitle: 'investment banking summer analyst',
    department: null,
    locations: ['New York, NY'],
    cities: ['nyc'],
    remote: false,
    postedAt: null,
    updatedAt: null,
    applyUrl: '/demo-posting/demo:acme:1',
    description: '',
    compensation: null,
    firstSeen: '2026-10-15',
    lastSeen: '2026-10-15',
    linkVerifiedAt: NOW,
    linkStatus: 'ok',
    isInternship: true,
    eligibility: { gradYears: [], phrases: [], evidence: null },
    classification: { industry: 'finance', career: 'investment-banking', family: 'business', method: 'rules', confidence: 0.9, evidence: [] },
    requirements: { required: ['excel', 'financial-modeling', 'valuation'], preferred: ['bloomberg'], minGpa: null, majors: [] },
    deadline: null,
    cycle: 'summer-2027',
    dedupeKey: 'acme|investment banking summer analyst|summer-2027',
    ...over,
  };
}

function profile(over: Partial<Profile> = {}): Profile {
  return {
    name: 'Test',
    email: null,
    school: null,
    majors: ['major:finance'],
    gpa: 3.7,
    gradYear: 2028,
    skills: ['excel', 'financial-modeling', 'valuation', 'bloomberg'],
    coursework: [],
    experience: [],
    wordCount: 300,
    ...over,
  };
}

const junior: Targets = { classYear: 'junior', industries: ['finance'], careers: ['investment-banking'], cities: ['nyc'], payFloorHourly: null };

describe('fit model', () => {
  it('Perfect needs a strong resume <-> requirements match and eligibility', () => {
    const me = profileSignals(profile(), junior, NOW);
    const r = scoreFit(posting({ eligibility: { gradYears: [2028], phrases: ['rising senior'], evidence: 'rising senior' } }), me, junior, NOW);
    expect(r.tier).toBe('perfect');
    expect(r.eligible).toBe(true);
    expect(r.matched).toEqual(expect.arrayContaining(['excel', 'financial-modeling', 'valuation', 'bloomberg']));
    expect(r.missing).toEqual([]);
  });

  it('career + industry + city match alone can never produce Perfect', () => {
    // Student matches every target but has none of the listed requirements.
    const me = profileSignals(profile({ skills: ['social-media'], majors: ['major:communications'] }), junior, NOW);
    const r = scoreFit(posting(), me, junior, NOW);
    expect(r.tier).not.toBe('perfect');
  });

  it('property: no posting reaches Perfect without matching at least 70% of weighted requirements', () => {
    const scored = SIGNALS.filter((s) => s.kind !== 'trait' && s.kind !== 'major').map((s) => s.id);
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const pick = (n: number) => Array.from({ length: n }, () => scored[Math.floor(rnd() * scored.length)] ?? 'excel');
    for (let i = 0; i < 2000; i++) {
      const req = [...new Set(pick(1 + Math.floor(rnd() * 5)))];
      const pref = [...new Set(pick(Math.floor(rnd() * 3)))].filter((s) => !req.includes(s));
      const skills = [...new Set(pick(Math.floor(rnd() * 8)))];
      const me = profileSignals(profile({ skills, majors: [] }), junior, NOW);
      const p = posting({ requirements: { required: req, preferred: pref, minGpa: null, majors: [] } });
      const r = scoreFit(p, me, junior, NOW);
      if (r.tier === 'perfect') {
        const hit = req.filter((s) => skills.includes(s)).length + 0.5 * pref.filter((s) => skills.includes(s)).length;
        expect(hit / (req.length + 0.5 * pref.length)).toBeGreaterThanOrEqual(0.7);
        expect(req.every((s) => skills.includes(s))).toBe(true);
      }
    }
  });

  it('class year is fit, not a filter: ineligible roles sink to Non-fit and stay in the list', () => {
    const freshman: Targets = { ...junior, classYear: 'freshman' };
    const me = profileSignals(profile(), freshman, NOW);
    const p = posting({ eligibility: { gradYears: [2028], phrases: ['rising senior'], evidence: null } });
    const r = scoreFit(p, me, freshman, NOW);
    expect(r.tier).toBe('nonfit');
    expect(r.eligible).toBe(false);
    const ranked = rankPostings([p], me, freshman, NOW);
    expect(ranked).toHaveLength(1);
  });

  it('unknown eligibility counts as open to everyone and is flagged', () => {
    const me = profileSignals(profile(), junior, NOW);
    const r = scoreFit(posting(), me, junior, NOW);
    expect(r.eligible).toBe(true);
    expect(r.eligibilityUnknown).toBe(true);
  });

  it('Almost = strong match with exactly one gap, and names the gap', () => {
    const me = profileSignals(profile({ skills: ['excel', 'financial-modeling', 'bloomberg'] }), junior, NOW);
    const r = scoreFit(posting(), me, junior, NOW);
    expect(r.tier).toBe('almost');
    expect(r.gap).toBe('Valuation');
    expect(r.missing).toEqual(['valuation']);
  });

  it('a GPA below the floor is a gap; a missing GPA is not', () => {
    const p = posting({ requirements: { required: ['excel', 'financial-modeling', 'valuation'], preferred: [], minGpa: 3.5, majors: [] } });
    const low = scoreFit(p, profileSignals(profile({ gpa: 3.2 }), junior, NOW), junior, NOW);
    expect(low.tier).toBe('almost');
    expect(low.gap).toContain('GPA');
    const none = scoreFit(p, profileSignals(profile({ gpa: null }), junior, NOW), junior, NOW);
    expect(none.tier).toBe('perfect');
    expect(none.reasons.join(' ')).toContain('Add yours');
  });

  it('"business" majors accept finance/marketing/accounting majors', () => {
    const p = posting({ requirements: { required: ['excel', 'financial-modeling', 'valuation'], preferred: [], minGpa: null, majors: ['major:business'] } });
    const r = scoreFit(p, profileSignals(profile(), junior, NOW), junior, NOW);
    expect(r.tier).toBe('perfect');
  });

  it('postings that list no skills cannot be Perfect', () => {
    const p = posting({ requirements: { required: [], preferred: [], minGpa: null, majors: [] } });
    const r = scoreFit(p, profileSignals(profile(), junior, NOW), junior, NOW);
    expect(r.tier).toBe('weak');
    const targeted = posting({
      requirements: { required: [], preferred: [], minGpa: null, majors: [] },
      eligibility: { gradYears: [2028], phrases: ['rising senior'], evidence: null },
    });
    expect(scoreFit(targeted, profileSignals(profile(), junior, NOW), junior, NOW).tier).toBe('almost');
  });

  it('targets only reorder within a tier', () => {
    const me = profileSignals(profile(), junior, NOW);
    const inTarget = posting({ id: 'a' });
    const offTarget = posting({
      id: 'b',
      cities: ['denver'],
      classification: { industry: 'consumer', career: 'marketing', family: 'business', method: 'rules', confidence: 0.9, evidence: [] },
    });
    const a = scoreFit(inTarget, me, junior, NOW);
    const b = scoreFit(offTarget, me, junior, NOW);
    expect(a.tier).toBe(b.tier);
    expect(a.score).toBeGreaterThan(b.score);
  });

  it('every result is explainable', () => {
    const me = profileSignals(profile({ skills: ['excel'] }), junior, NOW);
    const r = scoreFit(posting(), me, junior, NOW);
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.matched).toContain('excel');
    expect(r.missing.length).toBeGreaterThan(0);
  });

  it('ranks Perfect > Almost > Weak > Non-fit', () => {
    const me = profileSignals(profile({ skills: ['excel', 'financial-modeling', 'bloomberg'] }), junior, NOW);
    const ranked = rankPostings(
      [
        posting({ id: 'weak', requirements: { required: ['excel', 'sql', 'python', 'tableau'], preferred: [], minGpa: null, majors: [] } }),
        posting({ id: 'almost' }),
        posting({ id: 'nonfit', eligibility: { gradYears: [2030], phrases: [], evidence: null } }),
        posting({ id: 'perfect', requirements: { required: ['excel', 'financial-modeling'], preferred: ['bloomberg'], minGpa: null, majors: [] } }),
      ],
      me,
      junior,
      NOW,
    );
    expect(ranked.map((r) => r.posting.id)).toEqual(['perfect', 'almost', 'weak', 'nonfit']);
  });
});

describe('pay floor', () => {
  it('ranks roles under the floor lower without changing their tier', () => {
    const t: Targets = { ...junior, payFloorHourly: 40 };
    const me = profileSignals(profile(), t, NOW);
    const low = posting({ id: 'low', compensation: { min: 20, max: 22, unit: 'hour', currency: 'USD', source: 'field', raw: '$20-$22/hr' } });
    const none = posting({ id: 'none' });
    const a = scoreFit(low, me, t, NOW);
    const b = scoreFit(none, me, t, NOW);
    expect(a.tier).toBe(b.tier);
    expect(a.score).toBeLessThan(b.score);
    expect(a.reasons.join(' ')).toContain('under your $40/hr floor');
  });
});
