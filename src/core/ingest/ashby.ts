import type { CompanySeed, Compensation } from '../types.ts';
import type { RawJob, SourceAdapter } from './adapter.ts';
import { asArray, asNumber, asRecord, asString, escapeHtml, fetchJson, fieldCompensation, hasRemoteWord, toIso, uniqueStrings } from './util.ts';
import type { PayUnit } from './util.ts';

/**
 * Ashby Job Postings API.
 *   GET https://api.ashbyhq.com/posting-api/job-board/{org}?includeCompensation=true
 *
 * `jobUrl` is the public posting page on jobs.ashbyhq.com (`applyUrl` is the same page's /application tab).
 * Compensation arrives as `summaryComponents` (typed: Salary, Bonus, EquityPercentage, ...); we use the
 * Salary component. NOTE: Ashby's `isRemote` is true for many hybrid roles, so `workplaceType` wins when
 * present. NOTE: Ashby serves HTTP 200 even for a closed/unknown posting id; verify.ts reads the body.
 */
export const ashbyUrl = (org: string): string =>
  `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}?includeCompensation=true`;

function intervalUnit(interval: string): PayUnit | null {
  const s = interval.toUpperCase();
  if (s.includes('HOUR')) return 'hour';
  if (s.includes('WEEK')) return 'week';
  if (s.includes('MONTH')) return 'month';
  if (s.includes('YEAR')) return 'year';
  return null;
}

function salaryFromComponents(components: unknown[], label: string | null): Compensation | null {
  for (const c of components) {
    const r = asRecord(c);
    if (!r || asString(r.compensationType) !== 'Salary') continue;
    const unit = intervalUnit(asString(r.interval) ?? '');
    const min = asNumber(r.minValue);
    const max = asNumber(r.maxValue);
    if (!unit || (min === null && max === null)) continue;
    return fieldCompensation(min, max, unit, asString(r.currencyCode) ?? 'USD', label);
  }
  return null;
}

/** "$48 per hour", "$12.5K per month", "$211.4K - $290.6K" -> Compensation, for boards that only give the summary text. */
export function parseSummaryText(text: string): Compensation | null {
  const m =
    /(?:[A-Z]{0,3})\$\s?([\d,]+(?:\.\d+)?)\s*([Kk])?(?:\s*[–-]\s*(?:[A-Z]{0,3})\$?\s?([\d,]+(?:\.\d+)?)\s*([Kk])?)?\s*(?:(?:per|\/)\s*(hour|hr|month|mo|week|wk|year|yr))?/.exec(
      text,
    );
  if (!m) return null;
  const num = (n: string | undefined, k: string | undefined): number | null =>
    n ? Number(n.replace(/,/g, '')) * (k ? 1000 : 1) : null;
  const lo = num(m[1], m[2]);
  const hi = num(m[3], m[4]) ?? lo;
  if (lo === null || hi === null || Number.isNaN(lo) || Number.isNaN(hi)) return null;
  const u = (m[5] ?? 'year').toLowerCase();
  const unit: PayUnit = u.startsWith('h') ? 'hour' : u.startsWith('m') ? 'month' : u.startsWith('w') ? 'week' : 'year';
  return fieldCompensation(lo, hi, unit, 'USD', text);
}

export function ashbyPay(value: unknown): Compensation | null {
  const c = asRecord(value);
  if (!c) return null;
  const label = asString(c.compensationTierSummary) ?? asString(c.scrapeableCompensationSalarySummary);
  const fromSummary = salaryFromComponents(asArray(c.summaryComponents), label);
  if (fromSummary) return fromSummary;
  const tier = asRecord(asArray(c.compensationTiers)[0]);
  const fromTier = tier ? salaryFromComponents(asArray(tier.components), label) : null;
  if (fromTier) return fromTier;
  return label ? parseSummaryText(label) : null;
}

export function parseAshby(json: unknown): RawJob[] {
  const root = asRecord(json);
  const jobs = root ? root.jobs : null;
  if (!Array.isArray(jobs)) throw new Error('Ashby response has no jobs array');
  const out: RawJob[] = [];
  for (const item of jobs) {
    const j = asRecord(item);
    if (!j) continue;
    if (j.isListed === false) continue;
    const externalId = asString(j.id);
    const title = asString(j.title);
    const applyUrl = asString(j.jobUrl) ?? asString(j.applyUrl);
    if (!externalId || !title || !applyUrl) continue;

    const locations = uniqueStrings([
      asString(j.location),
      ...asArray(j.secondaryLocations).map((l) => asString(asRecord(l)?.location)),
    ]);
    const workplace = asString(j.workplaceType);
    const remote = workplace ? workplace.toLowerCase() === 'remote' : j.isRemote === true;
    const html = asString(j.descriptionHtml) ?? (asString(j.descriptionPlain) ? `<p>${escapeHtml(asString(j.descriptionPlain) ?? '')}</p>` : '');
    out.push({
      externalId,
      title,
      department: asString(j.department) ?? asString(j.team),
      locations,
      remoteHint: remote || hasRemoteWord(locations),
      postedAt: toIso(j.publishedAt),
      updatedAt: null,
      applyUrl,
      descriptionHtml: html,
      compensation: ashbyPay(j.compensation),
    });
  }
  return out;
}

export const ashbyAdapter: SourceAdapter = {
  source: 'ashby',
  async fetchJobs(seed: CompanySeed, fetchImpl: typeof fetch): Promise<RawJob[]> {
    return parseAshby(await fetchJson(fetchImpl, ashbyUrl(seed.token)));
  },
};
