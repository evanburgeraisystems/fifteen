/**
 * Final gate: typecheck, lint, unit tests, production build and the full
 * Playwright suite, in order. Appends one line per run to docs/GATE_RUNS.md so
 * "three consecutive clean runs" is recorded, not claimed.
 *
 *   node scripts/gate.ts
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';

const steps: { name: string; cmd: string }[] = [
  { name: 'typecheck', cmd: 'npx tsc -b' },
  { name: 'lint', cmd: 'npx eslint . --max-warnings 0' },
  { name: 'unit', cmd: 'npx vitest run' },
  { name: 'build', cmd: 'npx vite build' },
  { name: 'e2e', cmd: 'npx playwright test' },
];

const log = 'docs/GATE_RUNS.md';
if (!existsSync(log)) {
  writeFileSync(log, '# Gate runs\n\nOne line per full run of `node scripts/gate.ts`.\n\n| Started | Result | Steps | Commit |\n|---|---|---|---|\n');
}

const started = new Date().toISOString();
const results: string[] = [];
let ok = true;
for (const s of steps) {
  const t0 = Date.now();
  console.info(`\n=== ${s.name}: ${s.cmd}`);
  const r = spawnSync(s.cmd, { stdio: 'inherit', shell: true });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const pass = r.status === 0;
  results.push(`${s.name} ${pass ? 'pass' : 'FAIL'} (${secs}s)`);
  if (!pass) {
    ok = false;
    break;
  }
}
const commit = spawnSync('git rev-parse --short HEAD', { shell: true, encoding: 'utf8' }).stdout.trim();
const dirty = spawnSync('git status --porcelain -- src scripts e2e', { shell: true, encoding: 'utf8' }).stdout.trim() ? ' (uncommitted changes)' : '';
appendFileSync(log, `| ${started} | ${ok ? 'CLEAN' : 'FAILED'} | ${results.join(', ')} | ${commit}${dirty} |\n`);
console.info(`\nGate ${ok ? 'CLEAN' : 'FAILED'}: ${results.join(', ')}`);
process.exit(ok ? 0 : 1);
