import type { CompanySeed, Compensation } from '../types.ts';
import type { RawJob, SourceAdapter } from './adapter.ts';
import {
  asArray,
  asNumber,
  asRecord,
  asString,
  decodeEntities,
  fetchJson,
  fieldCompensation,
  hasRemoteWord,
  toIso,
  uniqueStrings,
} from './util.ts';
import type { PayUnit } from './util.ts';

/**
 * Greenhouse Job Board API.
 *   GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true&pay_transparency=true
 *
 * `content=true` adds the description. It is HTML that was entity-escaped once, so we decode one level.
 * `pay_transparency=true` (an additive, public query flag) adds `pay_input_ranges`, the structured pay
 * the employer publishes for pay-transparency states; amounts are in cents.
 * `absolute_url` is the employer-facing posting page (boards.greenhouse.io or the employer's own domain).
 */
export const greenhouseUrl = (token: string): string =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true&pay_transparency=true`;

function payUnit(title: string, lowCents: number): PayUnit {
  if (/\b(hour|hourly|hr)\b/i.test(title)) return 'hour';
  if (/\bweek/i.test(title)) return 'week';
  if (/\bmonth/i.test(title)) return 'month';
  if (/\b(annual|year|salary|yearly)\b/i.test(title)) return 'year';
  // No unit word: a whole-dollar figure under $1,000 is an hourly rate, anything bigger is annual.
  return lowCents / 100 < 1000 ? 'hour' : 'year';
}

/** Collapse Greenhouse's per-zone ranges into one Compensation (lowest min, highest max, one currency). */
export function greenhousePay(value: unknown): Compensation | null {
  const ranges = asArray(value)
    .map((r) => asRecord(r))
    .filter((r): r is Record<string, unknown> => r !== null)
    .map((r) => ({
      min: asNumber(r.min_cents),
      max: asNumber(r.max_cents),
      currency: asString(r.currency_type) ?? 'USD',
      title: asString(r.title) ?? '',
    }))
    .filter((r) => r.min !== null || r.max !== null);
  const first = ranges[0];
  if (!first) return null;
  const same = ranges.filter((r) => r.currency === first.currency);
  const lows = same.map((r) => r.min ?? r.max).filter((n): n is number => n !== null);
  const highs = same.map((r) => r.max ?? r.min).filter((n): n is number => n !== null);
  const lowCents = Math.min(...lows);
  const highCents = Math.max(...highs);
  const unit = payUnit(first.title, lowCents);
  return fieldCompensation(lowCents / 100, highCents / 100, unit, first.currency, first.title.replace(/:\s*$/, '') || null);
}

export function parseGreenhouse(json: unknown): RawJob[] {
  const root = asRecord(json);
  const jobs = root ? root.jobs : null;
  if (!Array.isArray(jobs)) throw new Error('Greenhouse response has no jobs array');
  const out: RawJob[] = [];
  for (const item of jobs) {
    const j = asRecord(item);
    if (!j) continue;
    const externalId = asString(j.id);
    const title = asString(j.title);
    const applyUrl = asString(j.absolute_url);
    if (!externalId || !title || !applyUrl) continue;

    const department = asString(asRecord(asArray(j.departments)[0])?.name);
    const primary = asString(asRecord(j.location)?.name);
    const locations = uniqueStrings([
      primary,
      ...asArray(j.offices).map((o) => {
        const rec = asRecord(o);
        return asString(rec?.location) ?? asString(rec?.name);
      }),
    ]);
    const updatedAt = toIso(j.updated_at);
    const content = asString(j.content);
    out.push({
      externalId,
      title,
      department,
      locations,
      // Office entries such as "US - Remote Zone 1" are pay zones, not a remote role: judge by the primary location.
      remoteHint: hasRemoteWord(primary ? [primary] : locations),
      postedAt: toIso(j.first_published) ?? updatedAt,
      updatedAt,
      applyUrl,
      descriptionHtml: content ? decodeEntities(content) : '',
      compensation: greenhousePay(j.pay_input_ranges),
    });
  }
  return out;
}

export const greenhouseAdapter: SourceAdapter = {
  source: 'greenhouse',
  async fetchJobs(seed: CompanySeed, fetchImpl: typeof fetch): Promise<RawJob[]> {
    return parseGreenhouse(await fetchJson(fetchImpl, greenhouseUrl(seed.token)));
  },
};
