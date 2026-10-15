import { readFile } from 'node:fs/promises';
import type { CompanySeed } from '../types.ts';
import { INDUSTRIES } from '../taxonomy.ts';
import { asRecord, asString } from './util.ts';

const SOURCES = new Set<string>(['greenhouse', 'lever', 'ashby']);
const INDUSTRY_IDS = new Set<string>(INDUSTRIES.map((i) => i.id));

/** Validate a parsed seed file. Adding a company must be one JSON line; mistakes should fail loudly. */
export function validateSeeds(json: unknown): CompanySeed[] {
  if (!Array.isArray(json)) throw new Error('companies.json must be a JSON array');
  const slugs = new Set<string>();
  const out: CompanySeed[] = [];
  json.forEach((item, i) => {
    const r = asRecord(item);
    const where = `companies.json[${i}]`;
    if (!r) throw new Error(`${where} is not an object`);
    const slug = asString(r.slug);
    const name = asString(r.name);
    const source = asString(r.source);
    const token = asString(r.token);
    const industry = asString(r.industry);
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error(`${where}: slug must be lowercase letters, digits, dashes`);
    if (slugs.has(slug)) throw new Error(`${where}: duplicate slug "${slug}"`);
    if (!name) throw new Error(`${where} (${slug}): missing name`);
    if (!source || !SOURCES.has(source)) throw new Error(`${where} (${slug}): source must be greenhouse, lever or ashby`);
    if (!token) throw new Error(`${where} (${slug}): missing token`);
    if (!industry || !INDUSTRY_IDS.has(industry)) throw new Error(`${where} (${slug}): unknown industry "${industry ?? ''}"`);
    slugs.add(slug);
    const careersUrl = asString(r.careersUrl);
    out.push({
      slug,
      name,
      source: source as CompanySeed['source'],
      token,
      industry: industry as CompanySeed['industry'],
      ...(careersUrl ? { careersUrl } : {}),
    });
  });
  return out;
}

export async function loadSeeds(file: string): Promise<CompanySeed[]> {
  return validateSeeds(JSON.parse(await readFile(file, 'utf8')) as unknown);
}
