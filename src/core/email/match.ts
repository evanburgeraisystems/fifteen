/**
 * Match a classified email to the tracker card it is about.
 * Company first (fuzzy: case, punctuation and legal-suffix insensitive),
 * then role-title token overlap to choose among several roles at one company.
 */
import { normalizeTitle } from '../cycle.ts';
import type { EmailClassification } from '../types.ts';

export interface MatchCandidate {
  postingId: string;
  dedupeKey: string;
  company: string;
  companySlug: string;
  title: string;
}

export interface EmailMatch {
  postingId: string;
  confidence: number;
  reason: string;
}

/** Below this the email is left unmatched (the app shows it in the "unmatched" tray). */
export const MATCH_THRESHOLD = 0.6;

const COMPANY_SUFFIX = new Set([
  'inc', 'incorporated', 'llc', 'llp', 'lp', 'ltd', 'limited', 'corp', 'corporation', 'co', 'company', 'plc', 'gmbh',
  'sa', 'ag', 'holdings', 'holding', 'group', 'the', 'recruiting', 'careers', 'talent', 'team', 'jobs',
]);

/** Lowercased, punctuation-free tokens with legal/noise suffixes removed. */
export function companyTokens(name: string): string[] {
  const toks = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
  const kept = toks.filter((t) => !COMPANY_SUFFIX.has(t));
  return kept.length > 0 ? kept : toks;
}

const squash = (toks: string[]): string => toks.join('');

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return prev[b.length] ?? 0;
}

/** 0..1 similarity between the email's company guess and a candidate company. */
export function companySimilarity(guess: string, company: string, slug: string): number {
  const g = companyTokens(guess);
  const c = companyTokens(company);
  if (g.length === 0 || c.length === 0) return 0;
  const gs = squash(g);
  const cs = squash(c);
  const slugKey = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (gs === cs || gs === slugKey) return 1;
  // slug is often the squashed name without legal suffixes: "acmecapital"
  if (slugKey && (gs.startsWith(slugKey) || slugKey.startsWith(gs)) && Math.min(gs.length, slugKey.length) >= 5) {
    return 0.9;
  }
  // one name is a whole-token prefix of the other ("Acme" vs "Acme Capital")
  const [short, long] = g.length <= c.length ? [g, c] : [c, g];
  const prefix = short.every((t, i) => long[i] === t);
  if (prefix && short.length < long.length) {
    return short.length === 1 && (short[0] ?? '').length < 4 ? 0.5 : 0.75;
  }
  // same words in a different order, or a subset ("Media Magnolia")
  const gset = new Set(g);
  const inter = c.filter((t) => gset.has(t)).length;
  const union = new Set([...g, ...c]).size;
  const jaccard = inter / union;
  // typos and spacing differences ("Peachtree Brand")
  const edit = 1 - levenshtein(gs, cs) / Math.max(gs.length, cs.length);
  const editScore = edit >= 0.85 ? 0.4 + 0.4 * edit : 0;
  return Math.max(jaccard >= 0.67 ? 0.6 + 0.3 * jaccard : 0, editScore, 0);
}

const ROLE_STOP = new Set(['intern', 'and', 'the', 'of', 'in', 'for', 'a', 'an', 'to', 'at', 'with']);

function roleTokens(title: string): string[] {
  return normalizeTitle(title)
    .split(' ')
    .filter((t) => t && !ROLE_STOP.has(t));
}

/** Share of the smaller role's meaningful tokens that appear in the other (0..1). */
export function roleOverlap(a: string, b: string): number {
  const ta = roleTokens(a);
  const tb = roleTokens(b);
  if (ta.length === 0 || tb.length === 0) {
    // titles that are just "Intern": equal normalized titles are a full match
    return normalizeTitle(a) === normalizeTitle(b) ? 1 : 0;
  }
  const sb = new Set(tb);
  const inter = ta.filter((t) => sb.has(t)).length;
  const union = new Set([...ta, ...tb]).size;
  const contain = inter / Math.min(ta.length, tb.length);
  const jac = inter / union;
  return 0.6 * contain + 0.4 * jac;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function matchEmailToCard(cls: EmailClassification, candidates: MatchCandidate[]): EmailMatch | null {
  if (!cls.companyGuess || candidates.length === 0) return null;

  // 1. company similarity, grouped by company slug
  const byCompany = new Map<string, { sim: number; cards: MatchCandidate[] }>();
  for (const c of candidates) {
    const sim = companySimilarity(cls.companyGuess, c.company, c.companySlug);
    if (sim < 0.6) continue;
    const g = byCompany.get(c.companySlug);
    if (g) g.cards.push(c);
    else byCompany.set(c.companySlug, { sim, cards: [c] });
  }
  if (byCompany.size === 0) return null;

  const companies = [...byCompany.entries()].sort((a, b) => b[1].sim - a[1].sim);
  const top = companies[0];
  if (!top) return null;
  const runnerUp = companies[1];
  // two different companies equally plausible: do not guess
  if (runnerUp && top[1].sim - runnerUp[1].sim < 0.1 && top[1].sim < 1) return null;

  const { sim, cards } = top[1];
  const companyName = cards[0]?.company ?? top[0];

  // 2. pick the role
  if (cards.length === 1) {
    const only = cards[0];
    if (!only) return null;
    let confidence: number;
    let reason: string;
    if (cls.roleGuess) {
      const ov = roleOverlap(cls.roleGuess, only.title);
      if (ov === 0) {
        // the email is about a role that is not this card
        confidence = sim * 0.5;
        reason = `${companyName} matched but role "${cls.roleGuess}" differs from "${only.title}"`;
      } else {
        confidence = sim * (0.85 + 0.1 * Math.min(ov, 1));
        reason = `company ${companyName}; role "${only.title}" overlaps ${(ov * 100).toFixed(0)}%`;
      }
    } else {
      confidence = sim * 0.85;
      reason = `company ${companyName}; only one tracked role`;
    }
    confidence = round2(confidence);
    return confidence >= MATCH_THRESHOLD ? { postingId: only.postingId, confidence, reason } : null;
  }

  // several roles at this company: need role evidence
  if (!cls.roleGuess) return null;
  const scored = cards
    .map((card) => ({ card, ov: roleOverlap(cls.roleGuess ?? '', card.title) }))
    .sort((a, b) => b.ov - a.ov);
  const best = scored[0];
  const next = scored[1];
  if (!best || best.ov < 0.34) return null;
  if (next && best.ov - next.ov < 0.1) return null;
  const confidence = round2(sim * (0.6 + 0.4 * Math.min(best.ov, 1)));
  if (confidence < MATCH_THRESHOLD) return null;
  return {
    postingId: best.card.postingId,
    confidence,
    reason: `company ${companyName}; best of ${cards.length} roles: "${best.card.title}" (${(best.ov * 100).toFixed(0)}% title overlap)`,
  };
}
