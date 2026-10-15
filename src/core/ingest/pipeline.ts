import type { CompanySeed, Posting, Snapshot, SourceRunResult } from '../types.ts';
import { getProvider, type ModelProvider } from '../provider/index.ts';
import { refineWithModel } from './model-fallback.ts';
import { ADAPTERS } from './index.ts';
import { normalizeJob } from './normalize.ts';
import { buildPreviousMap, readSnapshots, trackingSinceFor, writeSnapshotFiles } from './snapshot.ts';
import { mapLimit } from './util.ts';
import { atsConfirmLive, rescueWithHostedUrl, verifyLinks } from './verify.ts';
import type { VerifyOptions } from './verify.ts';

export interface PipelineOptions {
  seeds: CompanySeed[];
  /** Where snapshots/, index.json and history.json live. */
  dataDir: string;
  /** Used for board requests. */
  fetchImpl: typeof fetch;
  /** Used for link verification; defaults to fetchImpl. */
  linkFetchImpl?: typeof fetch;
  now?: Date;
  /** Boards pulled in parallel. Default 6. */
  concurrency?: number;
  /** Skip link verification (everything stays 'unchecked' and is therefore NOT written). Default true. */
  verify?: boolean;
  linkOptions?: VerifyOptions;
  /** Skip writing files (dry run). Default true. */
  write?: boolean;
  log?: (line: string) => void;
  /** Model provider for low-confidence classification. Default: from FIFTEEN_MODEL_PROVIDER (mock). */
  provider?: ModelProvider;
}

export interface CompanyOutcome {
  seed: CompanySeed;
  ok: boolean;
  fetched: number;
  /** Internships found on the board (before link verification). */
  internships: number;
  /** Carried over from the last snapshot because the board failed to load. */
  carried: number;
  error: string | null;
}

export interface PipelineResult {
  snapshot: Snapshot;
  outcomes: CompanyOutcome[];
  linkCounts: { ok: number; dead: number; error: number };
  /** False when nothing was written (dry run, or every board failed). */
  wrote: boolean;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Pull every board, keep internships, verify links, write the snapshot and rebuild history. */
export async function runPipeline(opts: PipelineOptions): Promise<PipelineResult> {
  const now = opts.now ?? new Date();
  const pulledAt = now.toISOString();
  const today = pulledAt.slice(0, 10);
  const log = opts.log ?? (() => undefined);
  const existing = await readSnapshots(opts.dataDir);
  const previous = buildPreviousMap(existing);
  const lastSnapshot = existing[existing.length - 1] ?? null;

  // 1. Pull + normalize every board, isolating failures per company.
  const pulled = await mapLimit(opts.seeds, opts.concurrency ?? 6, async (seed) => {
    try {
      const adapter = ADAPTERS[seed.source];
      const raws = await adapter.fetchJobs(seed, opts.fetchImpl);
      const byId = new Map<string, Posting>();
      for (const raw of raws) {
        const posting = normalizeJob(raw, seed, { pulledAt, today, previous });
        if (posting.isInternship) byId.set(posting.id, posting);
      }
      const postings = [...byId.values()];
      log(`  ok    ${seed.slug} (${seed.source}) ${raws.length} jobs, ${postings.length} internships`);
      return { seed, ok: true, fetched: raws.length, postings, openIds: new Set(raws.map((r) => r.externalId)), error: null as string | null };
    } catch (e) {
      log(`  FAIL  ${seed.slug} (${seed.source}) ${message(e)}`);
      return { seed, ok: false, fetched: 0, postings: [] as Posting[], openIds: null as Set<string> | null, error: message(e) };
    }
  });

  // 2. A board that failed to load keeps yesterday's postings (re-verified below) instead of "closing" them.
  const outcomes: CompanyOutcome[] = [];
  const all: Posting[] = [];
  const owner = new Map<string, string>();
  for (const r of pulled) {
    let postings = r.postings;
    let carried = 0;
    if (!r.ok && lastSnapshot) {
      postings = lastSnapshot.postings
        .filter((p) => p.companySlug === r.seed.slug)
        .map((p) => ({ ...p, linkStatus: 'unchecked' as const, linkVerifiedAt: null }));
      carried = postings.length;
    }
    for (const p of postings) {
      all.push(p);
      owner.set(p.id, r.seed.slug);
    }
    outcomes.push({ seed: r.seed, ok: r.ok, fetched: r.fetched, internships: r.ok ? postings.length : 0, carried, error: r.error });
  }

  // 2b. Rules first, model second: refine low-confidence classifications.
  const provider = opts.provider ?? getProvider(process.env);
  const refined = await refineWithModel(all, provider);
  if (refined) log(`  ${refined} classification${refined === 1 ? '' : 's'} refined by the ${provider.name} provider`);

  // 3. Verify links. Boards we just read tell us which ids are open, so a bot-blocked employer site needs no extra request.
  const known = new Map<string, ReadonlySet<string>>();
  for (const r of pulled) if (r.openIds) known.set(r.seed.slug, r.openIds);
  const linkFetch = opts.linkFetchImpl ?? opts.fetchImpl;
  if (opts.verify !== false) {
    log(`Verifying ${all.length} links...`);
    const linkOpts: VerifyOptions = {
      confirmLive: atsConfirmLive(opts.seeds, linkFetch, { known }),
      ...opts.linkOptions,
      now: pulledAt,
    };
    await verifyLinks(all, linkFetch, linkOpts);
    const rescued = await rescueWithHostedUrl(all, opts.seeds, linkFetch, linkOpts);
    if (rescued) log(`  ${rescued} dead employer-site link${rescued === 1 ? '' : 's'} replaced by the Greenhouse-hosted posting page`);
  }

  // 4. Only links that resolved are live.
  const live = all.filter((p) => p.linkStatus === 'ok');
  const linkCounts = {
    ok: live.length,
    dead: all.filter((p) => p.linkStatus === 'dead').length,
    error: all.filter((p) => p.linkStatus === 'error' || p.linkStatus === 'unchecked').length,
  };

  const sources: SourceRunResult[] = outcomes.map((o) => {
    const mine = all.filter((p) => owner.get(p.id) === o.seed.slug);
    const kept = mine.filter((p) => p.linkStatus === 'ok').length;
    const dead = mine.filter((p) => p.linkStatus === 'dead').length;
    const unverifiable = mine.length - kept - dead;
    const notes: string[] = [];
    if (!o.ok) notes.push(`board failed: ${o.error ?? 'unknown'}${o.carried ? `; ${o.carried} postings carried from ${lastSnapshot?.date ?? '?'}` : ''}`);
    if (dead) notes.push(`${dead} dead link${dead === 1 ? '' : 's'} dropped`);
    if (unverifiable) notes.push(`${unverifiable} unverifiable link${unverifiable === 1 ? '' : 's'} dropped`);
    return {
      companySlug: o.seed.slug,
      source: o.seed.source,
      ok: o.ok,
      fetched: o.fetched,
      kept,
      error: notes.length ? notes.join('; ') : null,
    };
  });

  live.sort((a, b) => a.companySlug.localeCompare(b.companySlug) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  const snapshot: Snapshot = {
    schemaVersion: 1,
    dataset: 'live',
    pulledAt,
    date: today,
    trackingSince: trackingSinceFor(existing, today),
    sources,
    postings: live,
  };

  const anyOk = outcomes.some((o) => o.ok);
  let wrote = false;
  if (opts.write !== false && anyOk && opts.verify !== false) {
    await writeSnapshotFiles(opts.dataDir, snapshot);
    wrote = true;
  }
  return { snapshot, outcomes, linkCounts, wrote };
}
