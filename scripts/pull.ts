/**
 * Daily listings pull.   node scripts/pull.ts [flags]
 *
 *   --offline        serve the recorded fixtures instead of the network (CI / dev). Writes to a scratch dir.
 *   --limit N        only the first N companies of the seed list. Writes to a scratch dir.
 *   --only a,b       only these company slugs (repeatable). Writes to a scratch dir.
 *   --out DIR        write snapshots/index/history to DIR instead of public/data.
 *   --write          with --offline/--limit/--only: write into public/data anyway (partial data!).
 *   --no-verify      skip link verification (dry run: nothing is written).
 *   --concurrency N  boards pulled in parallel (default 6).
 *   --debug-http     print a host/status histogram of every request at the end.
 *
 * A full live run (no flags) writes public/data/snapshots/YYYY-MM-DD.json, latest.json, index.json
 * and history.json. Partial and offline runs never touch the committed dataset unless asked to.
 */
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { OFFLINE_SEEDS, createFixtureFetch } from '../src/core/ingest/offline.ts';
import { runPipeline } from '../src/core/ingest/pipeline.ts';
import type { CompanyOutcome, PipelineResult } from '../src/core/ingest/pipeline.ts';
import { loadSeeds } from '../src/core/ingest/seeds.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

const { values } = parseArgs({
  options: {
    offline: { type: 'boolean', default: false },
    limit: { type: 'string' },
    only: { type: 'string', multiple: true },
    out: { type: 'string' },
    write: { type: 'boolean', default: false },
    'no-verify': { type: 'boolean', default: false },
    concurrency: { type: 'string' },
    'debug-http': { type: 'boolean', default: false },
  },
  allowPositionals: false,
});

function table(rows: string[][]): string {
  const widths = rows[0]?.map((_, c) => Math.max(...rows.map((r) => (r[c] ?? '').length))) ?? [];
  return rows.map((r) => r.map((cell, c) => (c === 0 ? cell.padEnd(widths[c] ?? 0) : cell.padStart(widths[c] ?? 0))).join('  ')).join('\n');
}

function summarize(result: PipelineResult, outDir: string): void {
  const bySource = new Map<string, { ok: number; failed: number; fetched: number; internships: number }>();
  for (const o of result.outcomes) {
    const s = bySource.get(o.seed.source) ?? { ok: 0, failed: 0, fetched: 0, internships: 0 };
    if (o.ok) s.ok += 1;
    else s.failed += 1;
    s.fetched += o.fetched;
    s.internships += o.internships;
    bySource.set(o.seed.source, s);
  }
  const rows: string[][] = [['source', 'boards ok', 'failed', 'jobs fetched', 'internships']];
  for (const [src, s] of [...bySource].sort()) rows.push([src, String(s.ok), String(s.failed), String(s.fetched), String(s.internships)]);
  console.info(`\n${table(rows)}`);

  const l = result.linkCounts;
  console.info(`\nLinks: ${l.ok} ok, ${l.dead} dead, ${l.error} error/unverified. Live internships kept: ${result.snapshot.postings.length}`);

  const failed: CompanyOutcome[] = result.outcomes.filter((o) => !o.ok);
  if (failed.length) {
    console.info('\nFailed boards (isolated, run continued):');
    for (const f of failed) console.info(`  ${f.seed.slug} (${f.seed.source}): ${f.error ?? 'unknown'}${f.carried ? ` [carried ${f.carried} from last snapshot]` : ''}`);
  }

  const top = [...result.snapshot.sources].filter((s) => s.kept > 0).sort((a, b) => b.kept - a.kept).slice(0, 10);
  if (top.length) console.info(`\nMost internships: ${top.map((t) => `${t.companySlug} ${t.kept}`).join(', ')}`);
  console.info(result.wrote ? `\nWrote ${result.snapshot.date} snapshot to ${path.join(outDir, 'snapshots')} (+ index.json, history.json).` : '\nNothing written.');
}

async function main(): Promise<number> {
  const offline = values.offline === true;
  let seeds = offline ? OFFLINE_SEEDS : await loadSeeds(path.join(ROOT, 'data', 'seed', 'companies.json'));

  const only = (values.only ?? []).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean);
  if (only.length) {
    const missing = only.filter((slug) => !seeds.some((s) => s.slug === slug));
    if (missing.length) throw new Error(`--only: unknown slug(s): ${missing.join(', ')}`);
    seeds = seeds.filter((s) => only.includes(s.slug));
  }
  if (values.limit !== undefined) {
    const n = Number(values.limit);
    if (!Number.isInteger(n) || n < 1) throw new Error('--limit needs a positive integer');
    seeds = seeds.slice(0, n);
  }
  const partial = offline || only.length > 0 || values.limit !== undefined;

  let outDir = values.out ? path.resolve(values.out) : path.join(ROOT, 'public', 'data');
  if (!values.out && partial && !values.write) {
    outDir = path.join(os.tmpdir(), `fifteen-data-${offline ? 'offline' : 'partial'}`);
    console.info(`Partial/offline run: writing to ${outDir} (use --write to target public/data).`);
  }
  await mkdir(outDir, { recursive: true });

  const concurrency = values.concurrency ? Number(values.concurrency) : 6;
  const histogram = new Map<string, number>();
  const tally = (key: string): void => void histogram.set(key, (histogram.get(key) ?? 0) + 1);
  const base = offline ? createFixtureFetch() : fetch;
  const fetchImpl: typeof fetch =
    values['debug-http'] === true
      ? async (input, init) => {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
          const host = new URL(url).hostname;
          try {
            const res = await base(input, init);
            tally(`${host} ${res.status}`);
            return res;
          } catch (e) {
            tally(`${host} ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
            throw e;
          }
        }
      : base;
  console.info(`Pulling ${seeds.length} board${seeds.length === 1 ? '' : 's'}${offline ? ' from fixtures' : ''}...`);

  const result = await runPipeline({
    seeds,
    dataDir: outDir,
    fetchImpl,
    concurrency,
    verify: values['no-verify'] !== true,
    write: values['no-verify'] !== true,
    log: (line) => console.info(line),
  });
  summarize(result, outDir);
  if (histogram.size) {
    console.info('\nHTTP histogram:');
    for (const [k, n] of [...histogram].sort((a, b) => b[1] - a[1])) console.info(`  ${String(n).padStart(5)}  ${k}`);
  }

  if (!result.outcomes.some((o) => o.ok)) {
    console.error('Every board failed: nothing written, previous snapshot left untouched.');
    return 1;
  }
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
