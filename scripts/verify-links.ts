/**
 * Re-verify every link in the latest snapshot, in place.   node scripts/verify-links.ts [--dir DIR]
 *
 * Postings whose link no longer resolves (dead or unverifiable) are dropped from latest.json and from the
 * dated snapshot of the same day, the per-company counts in sources[] are updated, and index.json and
 * history.json are rebuilt. Greenhouse postings on employer domains are additionally confirmed against the
 * Greenhouse board API, because a closed job there can keep its gh_jid in the URL.
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadSeeds } from '../src/core/ingest/seeds.ts';
import { readLatest, writeSnapshotFiles } from '../src/core/ingest/snapshot.ts';
import { atsConfirmLive, rescueWithHostedUrl, verifyLinks } from '../src/core/ingest/verify.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const { values } = parseArgs({ options: { dir: { type: 'string' } }, allowPositionals: false });

async function main(): Promise<number> {
  const dataDir = values.dir ? path.resolve(values.dir) : path.join(ROOT, 'public', 'data');
  const latest = await readLatest(dataDir);
  if (!latest) {
    console.error(`No latest.json under ${dataDir}/snapshots. Run "npm run pull" first.`);
    return 1;
  }
  const seeds = await loadSeeds(path.join(ROOT, 'data', 'seed', 'companies.json'));
  const now = new Date();
  console.info(`Re-verifying ${latest.postings.length} links from ${latest.date}...`);
  const opts = { now, confirmLive: atsConfirmLive(seeds, fetch), confirmCustomDomains: true };
  await verifyLinks(latest.postings, fetch, opts);
  const rescued = await rescueWithHostedUrl(latest.postings, seeds, fetch, opts);
  if (rescued) console.info(`${rescued} dead employer-site link(s) replaced by the Greenhouse-hosted posting page.`);

  const before = latest.postings.length;
  const keep = latest.postings.filter((p) => p.linkStatus === 'ok');
  const dead = latest.postings.filter((p) => p.linkStatus === 'dead').length;
  const error = before - keep.length - dead;
  latest.postings = keep;
  latest.sources = latest.sources.map((s) => {
    const kept = keep.filter((p) => p.companySlug === s.companySlug).length;
    return { ...s, kept };
  });
  await writeSnapshotFiles(dataDir, latest);
  console.info(`Links: ${keep.length} ok, ${dead} dead, ${error} error/unverified. Dropped ${before - keep.length}.`);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  },
);
