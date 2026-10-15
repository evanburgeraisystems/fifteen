/**
 * Shared test fixture. Every test fails if the page logs a console error or warning,
 * throws, or has a same-origin request fail or return an error status. Popups opened
 * by the test (job links open in a new tab) are watched too.
 */
import { test as base, expect, type ConsoleMessage, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SCREEN_DIR } from './data.ts';
import { settle } from './app.ts';

/**
 * Investigation aid only: E2E_IGNORE=substring1,substring2 drops matching problems so one known
 * app bug does not hide every other failure. Unset in normal and CI runs.
 */
const IGNORE = (process.env.E2E_IGNORE ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export type Shoot = (step: string, page?: Page) => Promise<void>;

interface Fixtures {
  /** Collected problems; asserted empty at teardown. */
  problems: string[];
  _guard: undefined;
  /** Returns a function that saves numbered full-page PNGs for one journey. */
  shots: (journey: string) => Shoot;
}

function describe(msg: ConsoleMessage): string {
  const loc = msg.location();
  return `console.${msg.type()}: ${msg.text()}${loc.url ? ` (${loc.url}:${loc.lineNumber})` : ''}`;
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  problems: async ({}, provide) => {
    await provide([]);
  },

  _guard: [
    async ({ page, context, problems, baseURL }, provide) => {
      const origin = new URL(baseURL ?? 'http://localhost:4173').origin;
      const sameOrigin = (url: string) => {
        try {
          return new URL(url).origin === origin;
        } catch {
          return false;
        }
      };
      const watch = (p: Page) => {
        p.on('console', (msg) => {
          const t = msg.type();
          if (t === 'error' || t === 'warning') problems.push(describe(msg));
        });
        p.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
        p.on('requestfailed', (req) => {
          if (!sameOrigin(req.url())) return;
          const reason = req.failure()?.errorText ?? 'unknown';
          // A page close or navigation cancelling an in-flight request is not an app failure.
          if (reason === 'net::ERR_ABORTED' && (p.isClosed() || req.resourceType() === 'document')) return;
          problems.push(`requestfailed: ${req.method()} ${req.url()} (${reason})`);
        });
        p.on('response', (res) => {
          if (sameOrigin(res.url()) && res.status() >= 400) problems.push(`http ${res.status()}: ${res.url()}`);
        });
      };
      watch(page);
      context.on('page', (p) => {
        if (p !== page) watch(p);
      });
      await provide(undefined);
      const real = problems.filter((m) => !IGNORE.some((i) => m.includes(i)));
      expect(real, 'console errors, warnings, page errors or failed same-origin requests').toEqual([]);
    },
    { auto: true },
  ],

  shots: async ({ page }, provide, testInfo) => {
    const dir = join(SCREEN_DIR, testInfo.project.name);
    mkdirSync(dir, { recursive: true });
    await provide((journey: string) => {
      let n = 0;
      return async (step: string, p?: Page) => {
        n += 1;
        const target = p ?? page;
        await settle(target);
        await target.screenshot({
          path: join(dir, `${journey}-${String(n).padStart(2, '0')}-${step}.png`),
          fullPage: true,
          caret: 'hide',
        });
      };
    });
  },
});

export { expect };
