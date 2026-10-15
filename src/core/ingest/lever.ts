import type { CompanySeed, Compensation } from '../types.ts';
import type { RawJob, SourceAdapter } from './adapter.ts';
import { asArray, asNumber, asRecord, asString, escapeHtml, fetchJson, fieldCompensation, hasRemoteWord, toIso, uniqueStrings } from './util.ts';
import type { PayUnit } from './util.ts';

/**
 * Lever Postings API.
 *   GET https://api.lever.co/v0/postings/{slug}?mode=json
 *
 * `hostedUrl` is the public posting page on jobs.lever.co. `createdAt` is epoch milliseconds (Lever has
 * no "updated" timestamp). The description is split across `description` (opening + body), `lists[]`
 * (titled <li> groups: responsibilities, requirements) and `additional` (closing); we stitch them back
 * into one HTML document. `salaryRange` is present only when the employer fills it in.
 */
export const leverUrl = (slug: string): string => `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;

function intervalUnit(interval: string): PayUnit | null {
  const s = interval.toLowerCase();
  if (s.includes('hour')) return 'hour';
  if (s.includes('week')) return 'week';
  if (s.includes('month')) return 'month';
  if (s.includes('year') || s.includes('annual')) return 'year';
  return null;
}

export function leverPay(value: unknown): Compensation | null {
  const r = asRecord(value);
  if (!r) return null;
  const unit = intervalUnit(asString(r.interval) ?? '');
  if (!unit) return null;
  return fieldCompensation(asNumber(r.min), asNumber(r.max), unit, asString(r.currency) ?? 'USD', null);
}

function buildDescription(j: Record<string, unknown>): string {
  const main = asString(j.description) ?? (asString(j.descriptionPlain) ? `<p>${escapeHtml(asString(j.descriptionPlain) ?? '')}</p>` : '');
  const lists = asArray(j.lists)
    .map((l) => asRecord(l))
    .filter((l): l is Record<string, unknown> => l !== null)
    .map((l) => {
      const heading = asString(l.text);
      const content = asString(l.content) ?? '';
      return `${heading ? `<h3>${heading}</h3>` : ''}<ul>${content}</ul>`;
    });
  const additional = asString(j.additional) ?? (asString(j.additionalPlain) ? `<p>${escapeHtml(asString(j.additionalPlain) ?? '')}</p>` : '');
  return [main, ...lists, additional].filter((p) => p !== '').join('\n');
}

export function parseLever(json: unknown): RawJob[] {
  if (!Array.isArray(json)) throw new Error('Lever response is not an array');
  const out: RawJob[] = [];
  for (const item of json) {
    const j = asRecord(item);
    if (!j) continue;
    const externalId = asString(j.id);
    const title = asString(j.text);
    const applyUrl = asString(j.hostedUrl);
    if (!externalId || !title || !applyUrl) continue;

    const cat = asRecord(j.categories) ?? {};
    const locations = uniqueStrings([asString(cat.location), ...asArray(cat.allLocations).map((l) => asString(l))]);
    const workplace = (asString(j.workplaceType) ?? '').toLowerCase();
    const posted = toIso(j.createdAt);
    out.push({
      externalId,
      title,
      department: asString(cat.department) ?? asString(cat.team),
      locations,
      remoteHint: workplace === 'remote' || hasRemoteWord(locations),
      postedAt: posted,
      updatedAt: null,
      applyUrl,
      descriptionHtml: buildDescription(j),
      compensation: leverPay(j.salaryRange),
    });
  }
  return out;
}

export const leverAdapter: SourceAdapter = {
  source: 'lever',
  async fetchJobs(seed: CompanySeed, fetchImpl: typeof fetch): Promise<RawJob[]> {
    return parseLever(await fetchJson(fetchImpl, leverUrl(seed.token)));
  },
};
