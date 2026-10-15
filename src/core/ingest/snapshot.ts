import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { HistoryFile, HistoryRole, IndustryId, Posting, Snapshot } from '../types.ts';

/**
 * Snapshot + history files. Layout under a data dir (default public/data):
 *
 *   snapshots/YYYY-MM-DD.json   one Snapshot per pull day (committed: this is the "Last Intern Cycle" dataset)
 *   snapshots/latest.json       same content as the newest dated file
 *   index.json                  { dates: [...ascending], latest }
 *   history.json                HistoryFile rebuilt from ALL dated snapshots
 *
 * A snapshot only ever contains postings whose link verified 'ok'; dead and unverifiable ones are
 * dropped before writing (their counts live in sources[]).
 */

export interface DataIndex {
  dates: string[];
  latest: string | null;
}

const DATED = /^(\d{4}-\d{2}-\d{2})\.json$/;

export const snapshotsDir = (dataDir: string): string => path.join(dataDir, 'snapshots');

/** One posting per line keeps git diffs and merge conflicts readable while staying compact. */
export function serializeSnapshot(s: Snapshot): string {
  const { postings, ...head } = s;
  const headJson = JSON.stringify(head);
  const rows = postings.map((p) => JSON.stringify(p)).join(',\n');
  return `${headJson.slice(0, -1)},"postings":[${rows ? `\n${rows}\n` : ''}]}\n`;
}

async function writeAtomic(file: string, content: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, content, 'utf8');
  await rename(tmp, file);
}

export async function readSnapshots(dataDir: string): Promise<Snapshot[]> {
  let names: string[];
  try {
    names = await readdir(snapshotsDir(dataDir));
  } catch {
    return [];
  }
  const snaps: Snapshot[] = [];
  for (const name of names.filter((n) => DATED.test(n)).sort()) {
    const text = await readFile(path.join(snapshotsDir(dataDir), name), 'utf8');
    snaps.push(JSON.parse(text) as Snapshot);
  }
  return snaps.sort((a, b) => a.date.localeCompare(b.date));
}

export async function readLatest(dataDir: string): Promise<Snapshot | null> {
  try {
    return JSON.parse(await readFile(path.join(snapshotsDir(dataDir), 'latest.json'), 'utf8')) as Snapshot;
  } catch {
    return null;
  }
}

/**
 * Earlier postings by id for firstSeen carry-over. The newest copy of each posting wins, but firstSeen is
 * the earliest ever recorded, so a posting that vanished for a day (and came back) keeps its real age.
 */
export function buildPreviousMap(snapshots: Snapshot[]): Map<string, Posting> {
  const map = new Map<string, Posting>();
  for (const snap of [...snapshots].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const p of snap.postings) {
      const earlier = map.get(p.id);
      map.set(p.id, earlier && earlier.firstSeen < p.firstSeen ? { ...p, firstSeen: earlier.firstSeen } : p);
    }
  }
  return map;
}

const isLive = (p: Posting): boolean => p.linkStatus === 'ok' && p.isInternship;
const dayOf = (iso: string | null): string | null => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null);

export function buildIndex(snapshots: Snapshot[]): DataIndex {
  const dates = snapshots.map((s) => s.date).sort();
  return { dates, latest: dates.length ? (dates[dates.length - 1] ?? null) : null };
}

/**
 * Aggregate every snapshot into the history file.
 *  - roles: one per dedupeKey. opened = earliest of firstSeen and the ATS posted date; closed = null when the
 *    role is in the newest snapshot, else the last day it was seen.
 *  - volume: per date and industry, the number of live internship postings (`open`) and how many of those
 *    were first seen that day (`opened`). Industries with no live postings that day are omitted.
 */
export function buildHistory(snapshots: Snapshot[], builtAt: string, dataset: 'live' | 'demo' = 'live'): HistoryFile {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const latestDate = sorted.length ? (sorted[sorted.length - 1]?.date ?? null) : null;
  const trackingSince = sorted[0]?.date ?? builtAt.slice(0, 10);

  const roles = new Map<string, HistoryRole>();
  const lastSeen = new Map<string, string>();
  const volume = new Map<string, { date: string; industry: IndustryId; open: number; opened: number }>();

  for (const snap of sorted) {
    for (const p of snap.postings) {
      if (!isLive(p)) continue;

      const vKey = `${snap.date}|${p.classification.industry}`;
      const v = volume.get(vKey) ?? { date: snap.date, industry: p.classification.industry, open: 0, opened: 0 };
      v.open += 1;
      if (p.firstSeen === snap.date) v.opened += 1;
      volume.set(vKey, v);

      const opened = [p.firstSeen, dayOf(p.postedAt)].filter((d): d is string => d !== null).sort()[0] ?? p.firstSeen;
      const prev = roles.get(p.dedupeKey);
      roles.set(p.dedupeKey, {
        dedupeKey: p.dedupeKey,
        companySlug: p.companySlug,
        company: p.company,
        normalizedTitle: p.normalizedTitle,
        title: p.title,
        industry: p.classification.industry,
        career: p.classification.career,
        cycle: p.cycle,
        opened: prev && prev.opened < opened ? prev.opened : opened,
        closed: null,
        compensation: p.compensation ?? prev?.compensation ?? null,
      });
      const seen = lastSeen.get(p.dedupeKey);
      if (!seen || p.lastSeen > seen) lastSeen.set(p.dedupeKey, p.lastSeen);
    }
  }

  const presentInLatest = new Set<string>();
  const newest = sorted[sorted.length - 1];
  if (newest) for (const p of newest.postings) if (isLive(p)) presentInLatest.add(p.dedupeKey);

  const roleList = [...roles.values()]
    .map((r) => ({ ...r, closed: presentInLatest.has(r.dedupeKey) ? null : (lastSeen.get(r.dedupeKey) ?? latestDate) }))
    .sort((a, b) => a.dedupeKey.localeCompare(b.dedupeKey));

  const volumeList = [...volume.values()].sort((a, b) => a.date.localeCompare(b.date) || a.industry.localeCompare(b.industry));

  return { schemaVersion: 1, dataset, trackingSince, builtAt, roles: roleList, volume: volumeList };
}

/**
 * Write today's snapshot (dated + latest), then rebuild index.json and history.json from every dated
 * snapshot on disk. Returns what it wrote.
 */
export async function writeSnapshotFiles(
  dataDir: string,
  snapshot: Snapshot,
): Promise<{ index: DataIndex; history: HistoryFile }> {
  const body = serializeSnapshot(snapshot);
  await writeAtomic(path.join(snapshotsDir(dataDir), `${snapshot.date}.json`), body);
  await writeAtomic(path.join(snapshotsDir(dataDir), 'latest.json'), body);

  const all = await readSnapshots(dataDir);
  const index = buildIndex(all);
  const history = buildHistory(all, snapshot.pulledAt, snapshot.dataset);
  await writeAtomic(path.join(dataDir, 'index.json'), `${JSON.stringify(index)}\n`);
  await writeAtomic(path.join(dataDir, 'history.json'), `${JSON.stringify(history)}\n`);
  return { index, history };
}

/** Earliest date any snapshot (including a not-yet-written one for `today`) covers. */
export function trackingSinceFor(existing: Snapshot[], today: string): string {
  const dates = existing.map((s) => s.date).concat(today).sort();
  return dates[0] ?? today;
}
