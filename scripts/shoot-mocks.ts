// Screenshots each design mock in docs/mocks/ at 1440x900.
// Run from the repo root: node scripts/shoot-mocks.ts
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const MOCKS = ['a-lavender-paper', 'b-ink-console', 'c-soft-rings'] as const;
const DIR = resolve(process.cwd(), 'docs', 'mocks');

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  for (const name of MOCKS) {
    const page = await context.newPage();
    await page.goto(pathToFileURL(resolve(DIR, `${name}.html`)).href);
    await page.screenshot({ path: resolve(DIR, `${name}.png`) });
    const size = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth,
      h: document.documentElement.scrollHeight,
    }));
    console.info(`${name}.png  content ${size.w}x${size.h}`);
    await page.close();
  }
} finally {
  await browser.close();
}
