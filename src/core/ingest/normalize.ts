import type { CompanySeed, Posting } from '../types.ts';
import { cycleYear, dedupeKey, inferCycle, normalizeTitle } from '../cycle.ts';
import {
  classifyRole,
  detectInternship,
  extractCompensationFromText,
  extractDeadline,
  extractEligibility,
  extractRequirements,
  htmlToText,
  matchCities,
} from '../classify/index.ts';
import type { RawJob } from './adapter.ts';

export const DESCRIPTION_CAP = 6000;

export interface NormalizeContext {
  /** ISO date-time of this pull. */
  pulledAt: string;
  /** YYYY-MM-DD of this pull (UTC). */
  today: string;
  /** Postings from earlier snapshots by id, for firstSeen carry-over. */
  previous: Map<string, Posting>;
}

/** Cap plain text at `cap` characters (the last character becomes an ellipsis when cut). */
export function capText(text: string, cap = DESCRIPTION_CAP): string {
  if (text.length <= cap) return text;
  return `${text.slice(0, cap - 1).trimEnd()}…`;
}

/**
 * Turn a raw board job into the app's Posting.
 *
 * Classification, eligibility and requirement extraction run on the FULL description (requirements often
 * sit at the bottom); only the stored description is capped. The link starts 'unchecked'; verify.ts
 * resolves it. Pay: the ATS field wins, otherwise pay-transparency text in the description.
 */
export function normalizeJob(raw: RawJob, seed: CompanySeed, ctx: NormalizeContext): Posting {
  const id = `${seed.source}:${seed.slug}:${raw.externalId}`;
  const prior = ctx.previous.get(id);
  const firstSeen = prior && prior.firstSeen < ctx.today ? prior.firstSeen : ctx.today;

  const text = htmlToText(raw.descriptionHtml);
  const normalizedTitle = normalizeTitle(raw.title);
  // An explicit year in the title wins. Otherwise the cycle is the one the posting was first seen open in
  // (its ATS posted date is often years old for evergreen reqs, and an internship open in autumn recruits next summer).
  const cycle = inferCycle(raw.title, firstSeen);
  const isInternship = detectInternship(raw.title, text);
  const where = matchCities(raw.locations);

  return {
    id,
    source: seed.source,
    company: seed.name,
    companySlug: seed.slug,
    externalId: raw.externalId,
    title: raw.title,
    normalizedTitle,
    department: raw.department,
    locations: raw.locations,
    cities: where.cities,
    remote: raw.remoteHint || where.remote,
    postedAt: raw.postedAt,
    updatedAt: raw.updatedAt,
    applyUrl: raw.applyUrl,
    description: capText(text),
    compensation: raw.compensation ?? extractCompensationFromText(text),
    firstSeen,
    lastSeen: ctx.today,
    linkVerifiedAt: null,
    linkStatus: 'unchecked',
    isInternship,
    eligibility: extractEligibility(raw.title, text, cycleYear(cycle)),
    classification: classifyRole({
      title: raw.title,
      department: raw.department,
      description: text,
      companyIndustry: seed.industry,
    }),
    requirements: extractRequirements(text),
    deadline: extractDeadline(text, raw.postedAt ?? ctx.pulledAt),
    cycle,
    dedupeKey: dedupeKey(seed.slug, normalizedTitle, cycle),
  };
}
