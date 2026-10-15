/**
 * The fit model.
 *
 *   Filters (industry, career, city) decide WHICH roles you see.
 *   Fit (resume <-> posting requirements, plus eligibility) decides WHERE they rank.
 *
 * Hard rules (tested in fit.test.ts):
 *  - Career + industry match can never by itself produce Perfect. Targets only
 *    move a role up or down INSIDE its tier.
 *  - Perfect requires a strong resume <-> requirements match AND eligibility.
 *  - Class year is part of fit, not a filter: ineligible roles sink to Non-fit
 *    tagged "Not eligible yet" and never disappear.
 *  - Every tier is explainable: matched and missing signals are returned.
 */
import { currentSpring, gradYearFor } from './cycle.ts';
import { HOURS_PER_YEAR, hourly } from './pay.ts';
import { findSignals, isScored, signalLabel } from './signals.ts';
import type { FitResult, FitTier, Posting, Profile, SignalId, Targets } from './types.ts';

/** Majors that satisfy a posting that asks for a "business" degree. */
const BUSINESS_FAMILY = new Set([
  'major:business',
  'major:finance',
  'major:accounting',
  'major:economics',
  'major:marketing',
  'major:supply-chain',
  'major:information-systems',
  'major:hr',
  'major:real-estate',
]);

/** Majors that satisfy a posting that asks for a quantitative/STEM degree. */
const QUANT_FAMILY = new Set(['major:stem', 'major:economics', 'major:finance', 'major:information-systems']);

export const TIER_ORDER: FitTier[] = ['perfect', 'almost', 'weak', 'nonfit'];

export const TIER_LABEL: Record<FitTier, string> = {
  perfect: 'Perfect',
  almost: 'Almost',
  weak: 'Weak',
  nonfit: 'Non-fit',
};

/** One-line legend, shown once per screen. */
export const TIER_LEGEND: Record<FitTier, string> = {
  perfect: 'your resume covers what they ask for, and you’re eligible',
  almost: 'strong match with one gap',
  weak: 'partial match',
  nonfit: 'little overlap, or not eligible yet',
};

export interface ProfileSignals {
  all: Set<SignalId>;
  majors: Set<SignalId>;
  gpa: number | null;
  gradYear: number;
}

/** Precompute the student's side once per render, not once per posting. */
export function profileSignals(profile: Profile | null, targets: Targets, nowIso: string): ProfileSignals {
  const gradYear = gradYearFor(targets.classYear, currentSpring(nowIso));
  const all = new Set<SignalId>();
  const majors = new Set<SignalId>();
  if (profile) {
    for (const s of profile.skills) all.add(s);
    for (const m of profile.majors) {
      majors.add(m);
      all.add(m);
    }
    for (const s of findSignals(profile.coursework.join(', '))) all.add(s);
  }
  return { all, majors, gpa: profile?.gpa ?? null, gradYear };
}

function majorSatisfies(asked: SignalId, have: Set<SignalId>): boolean {
  if (have.has(asked)) return true;
  if (asked === 'major:business') return [...have].some((m) => BUSINESS_FAMILY.has(m));
  if (asked === 'major:stem') return [...have].some((m) => QUANT_FAMILY.has(m));
  if (asked === 'major:economics') return have.has('major:finance');
  if (asked === 'major:finance') return have.has('major:economics') || have.has('major:accounting');
  return false;
}

const DAY = 86_400_000;

/**
 * Score one posting for one student.
 * `targets` only adjusts `score` inside a tier, never the tier.
 */
export function scoreFit(posting: Posting, me: ProfileSignals, targets: Targets, nowIso: string): FitResult {
  const reasons: string[] = [];
  const matched: SignalId[] = [];
  const missing: SignalId[] = [];

  // ---- eligibility (class year is fit, not a filter) ----
  const years = posting.eligibility.gradYears;
  const eligibilityUnknown = years.length === 0;
  const eligible = eligibilityUnknown || years.includes(me.gradYear);
  if (!eligible) {
    reasons.push(`For students graduating ${years.join(' or ')}; you graduate ${me.gradYear}.`);
  } else if (!eligibilityUnknown) {
    reasons.push(`Open to your class (graduating ${me.gradYear}).`);
  }

  // ---- resume <-> requirements ----
  const req = unique(posting.requirements.required.filter((s) => isScored(s) && !s.startsWith('major:')));
  const pref = unique(
    posting.requirements.preferred.filter((s) => isScored(s) && !s.startsWith('major:') && !req.includes(s)),
  );
  let reqHit = 0;
  for (const s of req) {
    if (me.all.has(s)) {
      reqHit++;
      matched.push(s);
    } else missing.push(s);
  }
  let prefHit = 0;
  for (const s of pref) {
    if (me.all.has(s)) {
      prefHit++;
      matched.push(s);
    }
  }
  const denom = req.length + 0.5 * pref.length;
  const strength = denom > 0 ? (reqHit + 0.5 * prefHit) / denom : 0;

  const hardGaps: string[] = missing.map((s) => signalLabel(s));

  // majors: one gap if the posting names majors and none of ours satisfy them
  const askedMajors = unique(posting.requirements.majors);
  if (askedMajors.length > 0) {
    const hit = askedMajors.find((m) => majorSatisfies(m, me.majors));
    if (hit) {
      matched.push(hit);
      reasons.push(`Your major fits (${signalLabel(hit).replace(' major', '')}).`);
    } else if (me.majors.size > 0) {
      hardGaps.push(`major (${askedMajors.map((m) => signalLabel(m).replace(' major', '')).join(' / ')})`);
      missing.push(...askedMajors);
    }
  }

  // GPA floor
  const minGpa = posting.requirements.minGpa;
  if (minGpa != null) {
    if (me.gpa != null && me.gpa < minGpa) {
      hardGaps.push(`GPA ${minGpa.toFixed(1)}+`);
      reasons.push(`Asks for a ${minGpa.toFixed(1)} GPA; yours is ${me.gpa.toFixed(2)}.`);
    } else if (me.gpa == null) {
      reasons.push(`Asks for a ${minGpa.toFixed(1)} GPA. Add yours in Settings to check.`);
    }
  }

  const scoredCount = req.length + pref.length;
  if (matched.length > 0) {
    reasons.unshift(`You have ${matched.filter((s) => !s.startsWith('major:')).map(signalLabel).join(', ') || 'the major they want'}.`);
  }
  if (missing.length > 0 && req.length > 0) {
    const m = missing.filter((s) => !s.startsWith('major:'));
    if (m.length) reasons.push(`Missing: ${m.map(signalLabel).join(', ')}.`);
  }

  // ---- tier ----
  let tier: FitTier;
  let gap: string | null = null;
  if (!eligible) {
    tier = 'nonfit';
  } else if (scoredCount === 0) {
    // The posting lists no skills we can read. A strong resume match is impossible
    // to prove, so it can't be Perfect. A program built for your class year is Almost.
    if (!eligibilityUnknown && hardGaps.length === 0) {
      tier = 'almost';
      gap = 'posting lists no specific skills';
      reasons.push('Built for your class year; the posting lists no specific skills.');
    } else {
      tier = hardGaps.length === 0 ? 'weak' : 'nonfit';
      reasons.push('The posting lists no specific skills, so we can’t rank it higher.');
    }
  } else if (hardGaps.length === 0 && strength >= 0.7 && reqHit + prefHit >= 2) {
    tier = 'perfect';
  } else if (hardGaps.length <= 1 && strength >= 0.5) {
    tier = 'almost';
    gap = hardGaps[0] ?? 'a few preferred skills';
  } else if (strength >= 0.2 || reqHit + prefHit >= 1) {
    tier = 'weak';
  } else {
    tier = 'nonfit';
  }

  // ---- rank inside tier: strength first, then targets, then freshness ----
  let score = strength * 70;
  if (targets.careers.includes(posting.classification.career)) score += 10;
  if (targets.industries.includes(posting.classification.industry)) score += 5;
  if (posting.cities.some((c) => targets.cities.includes(c))) score += 5;
  const ageDays = Math.max(0, (Date.parse(nowIso) - Date.parse(posting.firstSeen)) / DAY);
  score += Math.max(0, 10 - ageDays / 3);
  // Pay floor: a role that lists pay under the floor ranks lower; unlisted pay is never penalized.
  const floor = targets.payFloorHourly;
  const rate = hourly(posting.compensation);
  if (floor != null && rate != null && rate < floor) {
    score -= 20;
    reasons.push(
      targets.payFloorUnit === 'year'
        ? `Lists ~$${Math.round((rate * HOURS_PER_YEAR) / 1000)}k/yr, under your $${Math.round((floor * HOURS_PER_YEAR) / 1000)}k/yr floor.`
        : `Lists ~$${Math.round(rate)}/hr, under your $${floor}/hr floor.`,
    );
  }
  score = Math.max(0, score);
  score = Math.round(Math.min(100, score));

  return {
    tier,
    score,
    eligible,
    eligibilityUnknown,
    matched: unique(matched),
    missing: unique(missing),
    reasons,
    gap,
  };
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

export interface Ranked {
  posting: Posting;
  fit: FitResult;
}

/** Sort by tier, then score, then newest. Stable and deterministic. */
export function rankPostings(postings: Posting[], me: ProfileSignals, targets: Targets, nowIso: string): Ranked[] {
  const out = postings.map((posting) => ({ posting, fit: scoreFit(posting, me, targets, nowIso) }));
  out.sort(compareRanked);
  return out;
}

export function compareRanked(a: Ranked, b: Ranked): number {
  const t = TIER_ORDER.indexOf(a.fit.tier) - TIER_ORDER.indexOf(b.fit.tier);
  if (t !== 0) return t;
  if (b.fit.score !== a.fit.score) return b.fit.score - a.fit.score;
  if (a.posting.firstSeen !== b.posting.firstSeen) return a.posting.firstSeen < b.posting.firstSeen ? 1 : -1;
  return a.posting.id < b.posting.id ? -1 : 1;
}
