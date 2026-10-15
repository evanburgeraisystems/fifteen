/**
 * WCAG AA check for every text/surface pair the UI uses, in both themes.
 * Parses tokens.css directly so the stylesheet stays the single source of truth.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast } from '../../../scripts/contrast.ts';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const out: Record<string, string> = {};
  for (const m of css.slice(open + 1, close).matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    if (m[1] && m[2]) out[m[1]] = m[2].toUpperCase();
  }
  return out;
}

const light = block(':root {');
const dark = { ...light, ...block(":root[data-theme='dark'] {") };

/** [text token, surface token, minimum ratio] */
const PAIRS: [string, string, number][] = [
  ['ink', 'bg', 4.5],
  ['ink', 'surface', 4.5],
  ['ink', 'surface-2', 4.5],
  ['ink', 'surface-3', 4.5],
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'surface-2', 4.5],
  ['text-muted', 'bg', 4.5],
  ['text-muted', 'surface', 4.5],
  ['text-muted', 'surface-2', 4.5],
  ['text-muted', 'surface-3', 4.5],
  ['primary-text', 'bg', 4.5],
  ['primary-text', 'surface', 4.5],
  ['primary-text', 'primary-soft', 4.5],
  ['primary-text', 'surface-2', 4.5],
  ['text-on-primary', 'primary', 4.5],
  ['text-on-primary', 'primary-hover', 4.5],
  ['text-on-primary', 'primary-active', 4.5],
  ['success', 'bg', 4.5],
  ['success', 'surface', 4.5],
  ['success', 'success-soft', 4.5],
  ['danger', 'bg', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['gold-ink', 'bg', 4.5],
  ['gold-ink', 'surface', 4.5],
  ['gold-ink', 'gold-tint', 4.5],
  ['lane-perfect-ink', 'lane-perfect', 4.5],
  // Non-text UI parts (lane rails, focus ring, input borders) need 3:1 against the page.
  ['focus', 'bg', 3],
  ['lane-perfect', 'bg', 3],
  ['gold', 'bg', 1.4],
];

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('%s theme contrast', (_name, t) => {
  it.each(PAIRS)('%s on %s', (fg, bg, min) => {
    const a = t[fg];
    const b = t[bg];
    expect(a, `missing --${fg}`).toBeDefined();
    expect(b, `missing --${bg}`).toBeDefined();
    expect(contrast(a ?? '', b ?? '')).toBeGreaterThanOrEqual(min);
  });

  it('Perfect is the most prominent lane (highest contrast against the page)', () => {
    const lanes = ['lane-perfect', 'lane-almost', 'lane-weak', 'lane-nonfit'].map((l) => contrast(t[l] ?? '', t.bg ?? ''));
    expect(lanes[0]).toBe(Math.max(...lanes));
    expect([...lanes].sort((x, y) => y - x)).toEqual(lanes);
  });
});
