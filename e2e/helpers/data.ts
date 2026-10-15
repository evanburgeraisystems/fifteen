/**
 * Reads the same dataset files the app loads, so tests can compare what the UI shows
 * against what the snapshot says. Everything here is read-only.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InboundEmail, Posting, Snapshot } from '../../src/core/types.ts';

export type DatasetName = 'demo' | 'demo-zero' | 'live';

const ROOT = resolve(import.meta.dirname, '..', '..');

export const SNAPSHOT_PATHS: Record<DatasetName, string> = {
  demo: resolve(ROOT, 'public/data/demo/latest.json'),
  'demo-zero': resolve(ROOT, 'public/data/demo-zero/latest.json'),
  live: resolve(ROOT, 'public/data/snapshots/latest.json'),
};

const cache = new Map<DatasetName, Snapshot>();

export function snapshotExists(name: DatasetName): boolean {
  return existsSync(SNAPSHOT_PATHS[name]);
}

export function loadSnapshot(name: DatasetName): Snapshot {
  const hit = cache.get(name);
  if (hit) return hit;
  const snap = JSON.parse(readFileSync(SNAPSHOT_PATHS[name], 'utf8')) as Snapshot;
  cache.set(name, snap);
  return snap;
}

/** Postings the app shows: internship, link ok on the latest pull, business family. */
export function visiblePostings(name: DatasetName): Posting[] {
  const snap = loadSnapshot(name);
  return snap.postings.filter(
    (p) =>
      p.isInternship &&
      p.linkStatus === 'ok' &&
      p.linkVerifiedAt != null &&
      p.linkVerifiedAt.slice(0, 10) === snap.date &&
      p.classification.family === 'business',
  );
}

export function findPosting(name: DatasetName, company: string, titlePart: string | RegExp): Posting {
  const hit = visiblePostings(name).find(
    (p) => p.company === company && (typeof titlePart === 'string' ? p.title.includes(titlePart) : titlePart.test(p.title)),
  );
  if (!hit) throw new Error(`No ${name} posting for ${company} matching ${String(titlePart)}`);
  return hit;
}

export function emailFixture(id: string): InboundEmail {
  const path = resolve(ROOT, 'e2e/fixtures/emails', `${id}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as InboundEmail;
}

/** The text a student would paste into Settings: headers, a blank line, then the body. */
export function rawEmailText(id: string): string {
  const e = emailFixture(id);
  return `From: ${e.from}\nSubject: ${e.subject}\n\n${e.body}`;
}

export const RESUME_DIR = resolve(ROOT, 'e2e/fixtures/resumes');
export const SCREEN_DIR = resolve(ROOT, 'e2e/__screens__');
