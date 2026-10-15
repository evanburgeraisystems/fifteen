/**
 * Cross-cutting quality gates: link integrity, accessibility (axe, WCAG 2 A/AA), keyboard use,
 * horizontal overflow, gutters, reduced motion and speed. Every test runs in all four projects,
 * so light and dark, desktop and phone are each covered.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';
import { clickTab, confirmApplied, idsIn, lane, settle, trackerCard } from './helpers/app.ts';
import { loadSnapshot } from './helpers/data.ts';
import { expect, test } from './helpers/fixtures.ts';
import { onboard, type OnboardOptions } from './helpers/onboard.ts';

const PRIYA: OnboardOptions = {
  resume: 'junior-priya.pdf',
  classYear: 'Junior',
  industries: ['Finance'],
  careers: ['Investment Banking'],
  cities: ['New York'],
  forwarding: 'skip',
  stars: ['Northwind Capital'],
};

const THEME = (info: TestInfo): 'light' | 'dark' => (info.project.name.endsWith('dark') ? 'dark' : 'light');

async function expectTheme(page: Page, info: TestInfo): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-theme', THEME(info));
}

// ---------------------------------------------------------------------------------------------
// (a) Links
// ---------------------------------------------------------------------------------------------

test.describe('links', () => {
  /** Every visible job link must be a posting that resolved on the latest pull. */
  async function checkLinks(page: Page, where: string): Promise<string[]> {
    const snap = loadSnapshot('demo');
    const byId = new Map(snap.postings.map((p) => [p.id, p]));
    const rows = await page.locator('article.job').evaluateAll((els) =>
      els.map((e) => ({
        id: e.getAttribute('data-posting-id') ?? '',
        href: (e.querySelector('h3.job-title a') as HTMLAnchorElement | null)?.href ?? '',
        target: (e.querySelector('h3.job-title a') as HTMLAnchorElement | null)?.target ?? '',
        rel: (e.querySelector('h3.job-title a') as HTMLAnchorElement | null)?.rel ?? '',
      })),
    );
    expect(rows.length, `${where}: job cards are listed`).toBeGreaterThan(0);
    const origin = new URL(page.url()).origin;
    for (const r of rows) {
      const p = byId.get(r.id);
      expect(p, `${where}: ${r.id} exists in the snapshot`).toBeTruthy();
      if (!p) continue;
      expect(r.href, `${where}: ${p.title}`).toBe(new URL(p.applyUrl, origin).href);
      expect(p.linkStatus, `${where}: ${p.id} linkStatus`).toBe('ok');
      expect(p.linkVerifiedAt?.slice(0, 10), `${where}: ${p.id} verified on the latest pull`).toBe(snap.date);
      expect(r.target).toBe('_blank');
      expect(r.rel).toContain('noopener');
    }
    return rows.map((r) => r.href);
  }

  test('every visible job link on Home and Every Job Listing resolved on the latest pull', async ({ page }) => {
    await onboard(page, PRIYA);
    // Expand every lane so "visible" means everything on the screen, not only the first eight.
    for (const tier of ['perfect', 'almost', 'weak', 'nonfit'] as const) {
      const more = lane(page, tier).getByRole('button', { name: /^Show \d+/ });
      while (await more.count()) await more.click();
    }
    const home = await checkLinks(page, 'Home');
    await clickTab(page, 'Every Job Listing');
    await expect(page.locator('.result-count')).toContainText(/Showing all/);
    const jobs = await checkLinks(page, 'Every Job Listing');
    expect(new Set(home).size, 'no link appears twice on Home').toBe(home.length);
    expect(new Set(jobs).size, 'no link appears twice on Every Job Listing').toBe(jobs.length);
  });

  test('demo links open a demo posting page that loads and says it is demo data', async ({ page, context }) => {
    await onboard(page, PRIYA);
    const id = (await idsIn(lane(page, 'perfect')))[0] ?? '';
    const posting = loadSnapshot('demo').postings.find((p) => p.id === id);
    expect(posting).toBeTruthy();
    const href = await page.locator(`article.job[data-posting-id="${id}"] h3.job-title a`).getAttribute('href');
    expect(href).toBe(`/demo-posting/${id}`);

    // A link opens in a fresh tab with no memory of this tab's dataset choice, exactly like a click does.
    const fresh = await context.newPage();
    const problems: string[] = [];
    fresh.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && problems.push(m.text()));
    await fresh.goto(href ?? '');
    await expect(fresh.locator('.demo-posting')).toBeVisible();
    await expect(fresh.getByText('Demo data.', { exact: false }).first()).toBeVisible();
    await expect(fresh.getByRole('heading', { level: 1, name: posting?.title ?? '' })).toBeVisible();
    expect(problems).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// (b) Accessibility
// ---------------------------------------------------------------------------------------------

async function axeViolations(page: Page): Promise<string[]> {
  await settle(page);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return result.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n` +
      v.nodes
        .slice(0, 4)
        .map((n) => `    ${n.target.join(' ')}  ${(n.failureSummary ?? '').split('\n').slice(1, 2).join(' ')}`)
        .join('\n'),
  );
}

test.describe('accessibility (axe, WCAG 2 A and AA)', () => {
  test('Home, Every Job Listing, Stars and company pages', async ({ page }, info) => {
    await onboard(page, PRIYA);
    await expectTheme(page, info);
    const checks: [string, () => Promise<void>][] = [
      ['Home', async () => {}],
      ['Every Job Listing', () => clickTab(page, 'Every Job Listing')],
      ['Stars', () => clickTab(page, 'Stars')],
      ['Company roles', () => page.goto('/company/northwind-capital').then(() => undefined)],
      ['Company pay', () => page.goto('/company/northwind-capital/pay').then(() => undefined)],
      ['Company cycle', () => page.goto('/company/northwind-capital/cycle').then(() => undefined)],
    ];
    for (const [name, go] of checks) {
      await go();
      await expect(page.locator('main#main')).toBeVisible();
      expect.soft(await axeViolations(page), `axe: ${name}`).toEqual([]);
    }
  });

  test('Tracker with cards, Settings and both Season close pages', async ({ page }, info) => {
    await onboard(page, PRIYA);
    await expectTheme(page, info);
    const ids = await idsIn(lane(page, 'perfect'));
    const [first, second] = [ids[0] ?? '', ids[1] ?? ''];
    await confirmApplied(page, first);
    await confirmApplied(page, second);

    await clickTab(page, 'Tracker');
    await expect(trackerCard(page, first)).toBeVisible();
    expect.soft(await axeViolations(page), 'axe: Tracker with cards').toEqual([]);

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    expect.soft(await axeViolations(page), 'axe: Settings').toEqual([]);

    await page.goto('/season');
    await expect(page.getByRole('heading', { name: 'Keep going.' })).toBeVisible();
    expect.soft(await axeViolations(page), 'axe: Season close, no offer').toEqual([]);

    await clickTab(page, 'Tracker');
    await trackerCard(page, first).getByRole('combobox', { name: /^Move .* to$/ }).selectOption({ label: 'Offer' });
    await expect(page.getByTestId('col-offer').getByTestId(`card-${first}`)).toBeVisible();
    await page.goto('/season');
    await expect(page.getByRole('heading', { name: 'Congrats!' })).toBeVisible();
    expect.soft(await axeViolations(page), 'axe: Season close, offer').toEqual([]);
  });

  test('onboarding steps', async ({ page }, info) => {
    await page.goto('/welcome?dataset=demo');
    await expect(page.getByTestId('resume-input')).toBeAttached();
    await expectTheme(page, info);
    expect.soft(await axeViolations(page), 'axe: /welcome resume').toEqual([]);

    await page.getByTestId('resume-input').setInputFiles('e2e/fixtures/resumes/junior-priya.pdf');
    await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible();
    expect.soft(await axeViolations(page), 'axe: /welcome confirm').toEqual([]);

    for (const [legend, label] of [
      ['Industries', 'Finance'],
      ['Careers', 'Investment Banking'],
      ['Cities', 'New York'],
    ] as const) {
      await page.getByRole('group', { name: new RegExp(`^${legend}`) }).getByRole('button', { name: label, exact: true }).click();
    }
    await page.getByRole('button', { name: /^Continue/ }).click();
    await expect(page.getByRole('heading', { name: /let emails move your tracker/i })).toBeVisible();
    expect.soft(await axeViolations(page), 'axe: /welcome forwarding').toEqual([]);

    await page.getByTestId('skip-forwarding').click();
    await expect(page.getByRole('heading', { name: /star a few companies/i })).toBeVisible();
    expect.soft(await axeViolations(page), 'axe: /welcome stars').toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// (c) Keyboard
// ---------------------------------------------------------------------------------------------

test.describe('keyboard', () => {
  test('Tab reaches the skip link, filters and the first job link, each with a visible outline', async ({ page }) => {
    await onboard(page, PRIYA);
    // A fresh load of Home, then Tab: a keyboard user starts at the top of the page.
    await page.goto('/');
    await expect(page.getByTestId('lane-perfect').locator('article.job').first()).toBeVisible();
    await settle(page);

    type Stop = { kind: string; label: string; outline: string; width: string };
    const stops: Stop[] = [];
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate((): Stop => {
        const el = document.activeElement as HTMLElement;
        const cs = getComputedStyle(el);
        const kind = el.matches('.skip-link')
          ? 'skip'
          : el.closest('nav[aria-label="Main"]')
            ? 'nav'
            : el.matches('.filter-btn')
              ? 'filter'
              : el.matches('h3.job-title a')
                ? 'job'
                : 'other';
        return { kind, label: (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().slice(0, 50), outline: cs.outlineStyle, width: cs.outlineWidth };
      });
      stops.push(stop);
      if (stop.kind === 'job') break;
    }
    const kinds = stops.map((s) => s.kind);
    expect(kinds[0], 'the first Tab stop is the skip link').toBe('skip');
    expect(kinds, 'filters are reachable by Tab').toContain('filter');
    expect(kinds.at(-1), 'the first job link is reachable by Tab').toBe('job');
    for (const s of stops) {
      expect(s.outline, `focus outline on "${s.label}" (${s.kind})`).not.toBe('none');
      expect(s.width, `focus outline width on "${s.label}"`).not.toBe('0px');
    }
    // The main navigation: in the tab order on desktop; the phone's tab bar sits after the content.
    const nav = page.getByRole('navigation', { name: 'Main' }).locator('a:visible').first();
    await nav.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(nav).toBeFocused();
    const outline = await nav.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline, 'focus outline on the first main nav link').not.toBe('none');
    if (page.viewportSize()!.width >= 900) expect(kinds, 'the main nav comes before the job list on desktop').toContain('nav');
  });

  test('keys 1 to 4 switch tabs', async ({ page }) => {
    await onboard(page, PRIYA);
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.keyboard.press('2');
    await expect(page).toHaveURL(/\/jobs$/);
    await page.keyboard.press('3');
    await expect(page).toHaveURL(/\/tracker$/);
    await page.keyboard.press('4');
    await expect(page).toHaveURL(/\/stars$/);
    await page.keyboard.press('1');
    await expect(page).toHaveURL(/\/$/);
  });

  test('"/" from another screen opens Every Job Listing with the cursor in the search', async ({ page }) => {
    await onboard(page, PRIYA);
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await page.keyboard.press('/');
    await expect(page).toHaveURL(/\/jobs/);
    await expect(page.locator('#job-search')).toBeFocused();
    // Typing digits in the search must not switch tabs.
    await page.keyboard.type('2');
    await expect(page).toHaveURL(/\/jobs/);
    await expect(page.locator('#job-search')).toHaveValue('2');
  });

  test('"/" on Every Job Listing jumps to the search', async ({ page }) => {
    await onboard(page, PRIYA);
    await clickTab(page, 'Every Job Listing');
    await expect(page.getByRole('heading', { name: 'Every Job Listing' })).toBeVisible();
    await page.getByRole('heading', { name: 'Every Job Listing' }).click();
    await expect(page.locator('#job-search')).not.toBeFocused();
    await page.keyboard.press('/');
    await expect(page.locator('#job-search')).toBeFocused();
  });
});

// ---------------------------------------------------------------------------------------------
// (d) No horizontal scroll
// ---------------------------------------------------------------------------------------------

test.describe('layout', () => {
  async function overflow(page: Page): Promise<{ scrollWidth: number; innerWidth: number }> {
    await settle(page);
    return page.evaluate(() => ({ scrollWidth: document.scrollingElement?.scrollWidth ?? 0, innerWidth: window.innerWidth }));
  }

  async function checkNoHScroll(page: Page, screens: [string, () => Promise<void>][]): Promise<void> {
    for (const [name, go] of screens) {
      await go();
      await expect(page.locator('main#main, .onboard-body, .demo-posting').first()).toBeVisible();
      const o = await overflow(page);
      expect.soft(o.scrollWidth, `${name}: scrollWidth ${o.scrollWidth} vs innerWidth ${o.innerWidth}`).toBeLessThanOrEqual(o.innerWidth);
    }
  }

  test('no horizontal scroll on any screen (forwarding skipped)', async ({ page }) => {
    await page.goto('/welcome?dataset=demo');
    await expect(page.getByTestId('resume-input')).toBeAttached();
    await checkNoHScroll(page, [['/welcome', async () => {}]]);
    await onboard(page, PRIYA);
    const id = (await idsIn(lane(page, 'perfect')))[0] ?? '';
    const go = (path: string) => async () => {
      await page.goto(path);
    };
    await confirmApplied(page, id);
    await page.reload();
    await checkNoHScroll(page, [
      ['Home', go('/')],
      ['Every Job Listing', go('/jobs')],
      ['Tracker with a card', go('/tracker')],
      ['Stars', go('/stars')],
      ['Company roles', go('/company/northwind-capital')],
      ['Company pay', go('/company/northwind-capital/pay')],
      ['Company cycle', go('/company/northwind-capital/cycle')],
      ['Settings', go('/settings')],
      ['Season close (no offer)', go('/season')],
      ['Demo posting', go(`/demo-posting/${id}?dataset=demo`)],
      ['Not found', go('/nowhere')],
    ]);
    // Settings with the paste-an-email tool open.
    await page.goto('/settings');
    await page.locator('summary', { hasText: 'Paste a forwarded email' }).click();
    await expect(page.locator('#raw-email')).toBeVisible();
    const o = await overflow(page);
    expect.soft(o.scrollWidth, `Settings with the paste tool open: ${o.scrollWidth} vs ${o.innerWidth}`).toBeLessThanOrEqual(o.innerWidth);
  });

  test('no horizontal scroll on Settings and Season close (forwarding connected, offer)', async ({ page }) => {
    await onboard(page, { ...PRIYA, forwarding: 'connect' });
    const id = (await idsIn(lane(page, 'perfect')))[0] ?? '';
    await confirmApplied(page, id);
    await clickTab(page, 'Tracker');
    await trackerCard(page, id).getByRole('combobox', { name: /^Move .* to$/ }).selectOption({ label: 'Offer' });
    await expect(page.getByTestId('col-offer').getByTestId(`card-${id}`)).toBeVisible();
    await page.reload();
    await checkNoHScroll(page, [
      ['Settings (forwarding connected)', async () => void (await page.goto('/settings'))],
      ['Season close (offer)', async () => void (await page.goto('/season'))],
    ]);
  });

  test('the right gutter on Home equals the left gutter', async ({ page }) => {
    await onboard(page, PRIYA);
    await settle(page);
    const m = await page.evaluate(() => {
      const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const lanes = rect('.lanes');
      const stars = rect('.home-stars');
      return { vw: document.documentElement.clientWidth, leftGutter: lanes.left, starsRight: stars.right, lanesLeft: lanes.left };
    });
    const expectedRight = m.vw - m.leftGutter;
    expect(
      Math.abs(m.starsRight - expectedRight),
      `New Stars right edge ${m.starsRight} vs ${expectedRight} (viewport ${m.vw}, left gutter ${m.leftGutter})`,
    ).toBeLessThanOrEqual(32);
  });
});

// ---------------------------------------------------------------------------------------------
// (f) Reduced motion
// ---------------------------------------------------------------------------------------------

test.describe('motion', () => {
  const halo = (page: Page) =>
    page.getByTestId('star-northwind-capital').evaluate((el) => getComputedStyle(el, '::after').animationName);

  test('prefers-reduced-motion turns the star halo animation off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await onboard(page, PRIYA);
    const star = page.getByTestId('star-northwind-capital');
    await expect(star).toHaveAttribute('data-glowing', 'true');
    expect(await halo(page)).toBe('none');
    await settle(page);
    // And the whole page stops running finite and infinite animations alike.
    const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
    expect(running, 'no animation keeps running under reduced motion').toBe(0);
  });

  test('without the preference the halo breathes', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await onboard(page, PRIYA);
    await expect(page.getByTestId('star-northwind-capital')).toHaveAttribute('data-glowing', 'true');
    expect(await halo(page)).not.toBe('none');
  });
});

// ---------------------------------------------------------------------------------------------
// (g) Performance
// ---------------------------------------------------------------------------------------------

test.describe('performance', () => {
  test('Home renders its lanes quickly with 2,400+ listings', async ({ page }, info) => {
    const snap = loadSnapshot('demo');
    expect(snap.postings.filter((p) => p.classification.family === 'business').length).toBeGreaterThanOrEqual(2400);
    await onboard(page, PRIYA);

    // Time from navigation start (performance.now() is relative to it) until a Perfect card is on screen.
    await page.addInitScript(() => {
      const w = window as unknown as { __lanesAt?: number };
      const tick = () => {
        if (document.querySelector('[data-testid="lane-perfect"] article.job')) w.__lanesAt = performance.now();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const runs: number[] = [];
    for (let i = 0; i < 3; i++) {
      await page.goto('/?dataset=demo');
      await page.waitForFunction(() => (window as unknown as { __lanesAt?: number }).__lanesAt !== undefined);
      runs.push(await page.evaluate(() => (window as unknown as { __lanesAt: number }).__lanesAt));
    }
    const sorted = [...runs].sort((a, b) => a - b);
    const median = sorted[1] ?? Infinity;
    const line = `[perf] ${info.project.name}: lanes rendered at ${runs.map((r) => `${Math.round(r)}ms`).join(', ')}; median ${Math.round(median)}ms`;
    console.info(line);
    info.annotations.push({ type: 'perf', description: line });
    const budget = info.project.name.startsWith('desktop') ? 1000 : 1500;
    expect(median, line).toBeLessThan(budget);
  });
});
