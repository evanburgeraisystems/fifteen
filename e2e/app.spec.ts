/**
 * Smaller flows around the main journeys: Home filters and the "why" panel, the Stars page,
 * company pages, and Settings (theme, targets, notifications, start over).
 */
import type { Page } from '@playwright/test';
import { clickSettings, clickTab, LANES, lane, type Lane } from './helpers/app.ts';
import { expect, test } from './helpers/fixtures.ts';
import { onboard, type OnboardOptions } from './helpers/onboard.ts';

const MAYA: OnboardOptions = {
  resume: 'freshman-maya.pdf',
  classYear: 'Freshman',
  industries: ['Finance', 'Consulting'],
  careers: ['Investment Banking', 'Consulting', 'Asset Management'],
  cities: ['New York', 'Remote'],
  forwarding: 'skip',
  stars: ['Northwind Capital'],
  starsLater: ['Halcyon Advisory'],
};

async function totalRoles(page: Page): Promise<number> {
  let total = 0;
  for (const tier of LANES as readonly Lane[]) {
    const label = await lane(page, tier).locator('.lane-count').getAttribute('aria-label');
    total += Number(/^(\d+) roles$/.exec(label ?? '')?.[1]);
  }
  return total;
}

test.describe('Home', () => {
  test('filters decide which roles show; the why panel explains a tier', async ({ page, shots }) => {
    const shoot = shots('home-filters');
    await onboard(page, MAYA);
    const narrow = await totalRoles(page);

    // Clearing the Industry and City filters widens the list: filters pick the roles, fit picks the lane.
    for (const name of [/^Industry:/, /^City:/, /^Career:/]) {
      await page.getByRole('button', { name }).click();
      await page.getByRole('button', { name: 'Clear' }).click();
      await page.keyboard.press('Escape');
    }
    await expect.poll(() => totalRoles(page)).toBeGreaterThan(narrow);
    await shoot('filters-cleared');

    // "Why" opens an explanation with the matched and missing signals.
    const firstCard = lane(page, 'almost').locator('article.job').first();
    const why = firstCard.getByRole('button', { name: /^Why / });
    await expect(why).toHaveAttribute('aria-expanded', 'false');
    await why.click();
    await expect(why).toHaveAttribute('aria-expanded', 'true');
    await expect(firstCard.locator('.why li').first()).toBeVisible();
    await why.click();
    await expect(why).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('Stars', () => {
  test('cards glow, clear one at a time, respect the alerts switch, and can be removed', async ({ page, shots }) => {
    const shoot = shots('stars-page');
    await onboard(page, MAYA);
    await clickTab(page, 'Stars');
    const northwind = page.getByTestId('starcard-northwind-capital');
    const halcyon = page.getByTestId('starcard-halcyon-advisory');
    await expect(northwind).toHaveAttribute('data-glowing', 'true');
    await expect(halcyon).toHaveAttribute('data-glowing', 'true');
    await expect(northwind).toContainText('Open now');
    await expect(halcyon.getByTestId('star-news')).toContainText(/open ~Oct 19/);
    await shoot('glowing');

    // Clicking a card clears that card only.
    await northwind.click({ position: { x: 8, y: 8 } });
    await expect(northwind).toHaveAttribute('data-glowing', 'false');
    await expect(halcyon).toHaveAttribute('data-glowing', 'true');

    // Turning a card's alerts off stops its glow.
    await halcyon.getByRole('switch', { name: 'Alerts for Halcyon Advisory' }).click();
    await expect(halcyon).toHaveAttribute('data-glowing', 'false');
    await halcyon.getByRole('switch', { name: 'Alerts for Halcyon Advisory' }).click();
    await expect(halcyon).toHaveAttribute('data-glowing', 'true');

    // Top Role Fits lists ranked roles with direct links.
    await northwind.getByRole('button', { name: 'Top Role Fits' }).click();
    await expect(northwind.locator('.role-fits li').first()).toBeVisible();
    await expect(northwind.locator('.role-fits a').first()).toHaveAttribute('href', /\/demo-posting\//);
    await shoot('top-fits');

    // Unstar removes the card; searching brings a company back.
    await halcyon.getByRole('button', { name: 'Unstar Halcyon Advisory' }).click();
    await expect(halcyon).toHaveCount(0);
    await page.locator('#company-search').fill('Halcyon');
    const row = page.getByRole('list', { name: 'Companies' }).getByRole('listitem').filter({ hasText: 'Halcyon Advisory' });
    await row.getByRole('button', { name: /Star/ }).click();
    await expect(page.getByTestId('starcard-halcyon-advisory')).toBeVisible();
  });

  test('company pages: roles, pay and last cycle', async ({ page, shots }) => {
    const shoot = shots('company');
    await onboard(page, MAYA);
    await clickTab(page, 'Stars');
    await page.getByTestId('starcard-northwind-capital').getByRole('link', { name: '~Pay at Each Level' }).click();
    await expect(page).toHaveURL(/\/company\/northwind-capital\/pay$/);
    await expect(page.getByRole('heading', { name: 'Northwind Capital', level: 1 })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Typical' })).toBeVisible();
    await shoot('pay');

    const sub = page.getByRole('navigation', { name: 'Northwind Capital sections' });
    await sub.getByRole('link', { name: 'Last Intern Cycle' }).click();
    await expect(page).toHaveURL(/\/company\/northwind-capital\/cycle$/);
    await expect(page.getByRole('table', { name: 'Last intern cycle timeline' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Last Intern Cycle' })).toHaveAttribute('aria-current', 'page');
    await shoot('cycle');

    await sub.getByRole('link', { name: 'Top Role Fits' }).click();
    await expect(page).toHaveURL(/\/company\/northwind-capital$/);
    await expect(page.locator('article.job').first()).toBeVisible();

    await page.goto('/company/not-a-company');
    await expect(page.getByRole('heading', { name: /don’t track that company/ })).toBeVisible();
  });
});

test.describe('Settings', () => {
  test('theme choice applies, persists, and System follows the device', async ({ page }, info) => {
    await onboard(page, MAYA);
    await clickSettings(page);
    const theme = page.getByRole('radiogroup', { name: 'Theme' });
    const html = page.locator('html');

    await theme.getByRole('radio', { name: 'Dark' }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Light' }).click();
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'System' }).click();
    await expect(html).toHaveAttribute('data-theme', info.project.name.endsWith('dark') ? 'dark' : 'light');
  });

  test('saving targets re-ranks Home; notification switches toggle', async ({ page, shots }) => {
    const shoot = shots('settings');
    await onboard(page, MAYA);
    await clickSettings(page);

    const save = page.getByRole('button', { name: 'Save targets' });
    await expect(save).toBeDisabled();
    const cities = page.getByRole('group', { name: /^Cities/ });
    await cities.getByRole('button', { name: 'Chicago', exact: true }).click();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByRole('status').filter({ hasText: 'Targets saved' })).toBeVisible();
    await expect(save).toBeDisabled();

    // Removing every city is not allowed.
    for (const label of ['New York', 'Remote', 'Chicago']) await cities.getByRole('button', { name: label, exact: true }).click();
    await expect(save).toBeDisabled();
    await page.getByRole('button', { name: 'Discard changes' }).click();

    for (const name of ['New hits', 'Star alerts', 'Weekly digest instead of daily']) {
      const sw = page.getByRole('switch', { name });
      const before = await sw.getAttribute('aria-checked');
      await sw.click();
      await expect(sw).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
    }
    await shoot('settings');

    await clickTab(page, 'Home');
    // New York, Chicago and Remote are now the city targets: the Home filter starts from them.
    await expect(page.getByRole('button', { name: 'City: New York +2' })).toBeVisible();
  });

  test('Clear everything starts over at the welcome screen', async ({ page }) => {
    await onboard(page, MAYA);
    await clickSettings(page);
    await page.getByRole('button', { name: 'Clear everything' }).click();
    await page.getByRole('button', { name: 'Keep my data' }).click();
    await expect(page.getByRole('button', { name: 'Clear everything' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear everything' }).click();
    await page.getByRole('button', { name: 'Yes, clear everything' }).click();
    await expect(page).toHaveURL(/\/welcome/);
    await expect(page.getByTestId('resume-input')).toBeAttached();
  });
});

test.describe('Onboarding', () => {
  test('targets are required before Continue, and a resume-free start is allowed', async ({ page }) => {
    await page.goto('/welcome?dataset=demo');
    await page.getByRole('button', { name: 'Continue without a resume' }).click();
    const next = page.getByRole('button', { name: /^Continue/ });
    await expect(next).toBeDisabled();
    await page.getByRole('group', { name: /^Industries/ }).getByRole('button', { name: 'Finance', exact: true }).click();
    await page.getByRole('group', { name: /^Careers/ }).getByRole('button', { name: 'Investment Banking', exact: true }).click();
    await expect(next).toBeDisabled();
    await page.getByRole('group', { name: /^Cities/ }).getByRole('button', { name: 'New York', exact: true }).click();
    await expect(next).toBeEnabled();
    await next.click();
    await page.getByTestId('skip-forwarding').click();
    await page.getByTestId('finish-onboarding').click();
    await expect(page.getByTestId('lane-perfect')).toBeVisible();
    // Without a resume nothing can rank above Weak.
    await expect(page.getByTestId('lane-perfect').locator('article.job')).toHaveCount(0);
    await expect(page.getByTestId('lane-almost').locator('article.job')).toHaveCount(0);
  });

  test('a wrong file type gets a clear message, not a crash', async ({ page }) => {
    await page.goto('/welcome?dataset=demo');
    await page.getByTestId('resume-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a resume') });
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Check what we read' })).toHaveCount(0);
  });
});
