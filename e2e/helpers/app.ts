import { expect, type Locator, type Page } from '@playwright/test';
import { findPosting, rawEmailText, type DatasetName } from './data.ts';

export const LANES = ['perfect', 'almost', 'weak', 'nonfit'] as const;
export type Lane = (typeof LANES)[number];

export type TabName = 'Home' | 'Every Job Listing' | 'Tracker' | 'Stars';

export function lane(page: Page, tier: Lane): Locator {
  return page.getByTestId(`lane-${tier}`);
}

/** A job card by posting id, wherever it is on the current screen. */
export function card(page: Page, postingId: string): Locator {
  return page.locator(`article.job[data-posting-id="${postingId}"]`).first();
}

/** Client-side navigation through the visible main nav (top bar on desktop, tab bar on mobile). */
export async function clickTab(page: Page, name: TabName): Promise<void> {
  const short = name === 'Every Job Listing' ? 'Listings' : name;
  const links = page.getByRole('navigation', { name: 'Main' }).locator('a:visible');
  await links.filter({ hasText: new RegExp(`^\\s*(${name}|${short})\\s*$`) }).first().click();
}

/**
 * Switches tab with the 1-4 keyboard shortcut. Used right after pasting an email in Settings: on a phone,
 * the connected-forwarding paste box is wider than the screen (a known layout bug that is reported
 * separately by the no-horizontal-scroll test), which makes the tab bar untappable from that page.
 */
export async function pressTab(page: Page, name: TabName): Promise<void> {
  const key = { Home: '1', 'Every Job Listing': '2', Tracker: '3', Stars: '4' }[name];
  await page.locator('#raw-email').blur();
  await page.keyboard.press(key);
}

/**
 * Clicks a job's title link and returns the popup it opens. The app marks the role Opened on click.
 * The popup is waited on until it has rendered something, so it cannot write stale state later.
 */
export async function openJob(page: Page, postingId: string): Promise<Page> {
  const c = card(page, postingId);
  await c.scrollIntoViewIfNeeded();
  const popupPromise = page.waitForEvent('popup');
  await c.locator('h3.job-title a').click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup.locator('main, .demo-posting, .boot').first()).toBeVisible();
  await expect(popup.locator('.boot')).toHaveCount(0);
  return popup;
}

/**
 * A student closing the employer tab and coming back to the app. Fires both signals the app
 * listens for: the tab going hidden then visible, and the window regaining focus.
 */
export async function returnFromPopup(page: Page, popup: Page): Promise<void> {
  await popup.close();
  await page.bringToFront();
  await page.evaluate(() => {
    const setVisibility = (state: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    setVisibility('hidden');
    setVisibility('visible');
    window.dispatchEvent(new Event('focus'));
  });
}

/** Pastes a fixture email's text into Settings and processes it, with real clicks and typing. */
export async function pasteEmail(page: Page, fixtureId: string): Promise<void> {
  await clickSettings(page);
  const box = page.locator('#raw-email');
  if (!(await box.isVisible())) await page.getByText('Paste a forwarded email').click();
  await box.fill(rawEmailText(fixtureId));
  await page.getByRole('button', { name: 'Process email' }).click();
  await expect(box).toHaveValue('');
}

export async function clickSettings(page: Page): Promise<void> {
  if (new URL(page.url()).pathname === '/settings') return;
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
}

/**
 * Searches Every Job Listing for a posting from the snapshot and returns its id once the card is shown.
 * Picking the id from the snapshot keeps the test honest about which role it means.
 */
export async function searchJobs(page: Page, dataset: DatasetName, company: string, titlePart: string): Promise<string> {
  const posting = findPosting(dataset, company, titlePart);
  await clickTab(page, 'Every Job Listing');
  await expect(page.getByRole('heading', { name: 'Every Job Listing' })).toBeVisible();
  await page.locator('#job-search').fill(posting.title);
  await expect(card(page, posting.id)).toBeVisible();
  return posting.id;
}

/** Tracker card by posting id. */
export function trackerCard(page: Page, postingId: string): Locator {
  return page.getByTestId(`card-${postingId}`);
}

/** Waits for entrance animations to finish. The star halo loops forever and is ignored. */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
  );
}

/** Posting ids listed in a Home lane (or any container), in page order. */
export async function idsIn(scope: Locator): Promise<string[]> {
  return scope.locator('article.job').evaluateAll((els) => els.map((e) => e.getAttribute('data-posting-id') ?? ''));
}

/** Open a role, come back, and answer "Yes": the role lands in the Tracker as Applied. */
export async function confirmApplied(page: Page, postingId: string): Promise<void> {
  const popup = await openJob(page, postingId);
  await returnFromPopup(page, popup);
  const prompt = page.getByTestId('return-prompt');
  await expect(prompt).toBeVisible();
  await prompt.getByRole('button', { name: 'Yes' }).click();
  await expect(prompt).toHaveCount(0);
  await expect(card(page, postingId).locator('.status-applied')).toBeVisible();
}
