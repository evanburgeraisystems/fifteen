import { expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { RESUME_DIR, type DatasetName } from './data.ts';
import type { Shoot } from './fixtures.ts';

export type ResumeFile = 'freshman-maya.pdf' | 'sophomore-jordan.docx' | 'junior-sam.pdf' | 'junior-priya.pdf';
export type ClassYearLabel = 'Freshman' | 'Sophomore' | 'Junior';

export interface OnboardOptions {
  resume: ResumeFile;
  classYear: ClassYearLabel;
  /** Chip labels exactly as shown, e.g. 'Finance', 'Consumer & Retail'. */
  industries: string[];
  careers: string[];
  cities: string[];
  forwarding: 'skip' | 'connect';
  /** Company names to star on the last step (only companies the app suggests for these targets). */
  stars: string[];
  /** Company names to star afterwards from the Stars page search, for companies the step does not suggest. */
  starsLater?: string[];
  dataset?: DatasetName;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Walks /welcome with real clicks: upload, confirm targets, forwarding choice, stars, finish. */
export async function onboard(page: Page, o: OnboardOptions, shoot?: Shoot): Promise<void> {
  await page.goto(`/welcome?dataset=${o.dataset ?? 'demo'}`);
  await expect(page.getByTestId('resume-input')).toBeAttached();
  await shoot?.('welcome-resume');
  await page.getByTestId('resume-input').setInputFiles(join(RESUME_DIR, o.resume));
  await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible();

  const year = page.getByRole('radio', { name: o.classYear, exact: true });
  await year.click();
  await expect(year).toHaveAttribute('aria-checked', 'true');

  const pick = async (legend: string, labels: string[]) => {
    const group = page.getByRole('group', { name: new RegExp(`^${legend}`) });
    for (const label of labels) {
      const chip = group.getByRole('button', { name: label, exact: true });
      if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
    }
  };
  await pick('Industries', o.industries);
  await pick('Careers', o.careers);
  await pick('Cities', o.cities);

  await shoot?.('welcome-targets');
  await page.getByRole('button', { name: /^Continue/ }).click();
  await expect(page.getByRole('heading', { name: /let emails move your tracker/i })).toBeVisible();
  await shoot?.('welcome-forwarding');
  if (o.forwarding === 'skip') await page.getByTestId('skip-forwarding').click();
  else await page.getByRole('button', { name: /I set up the filter/ }).click();

  await expect(page.getByRole('heading', { name: /star a few companies/i })).toBeVisible();
  const suggested = page.getByRole('group', { name: 'Suggested companies' });
  for (const name of o.stars) {
    const chip = suggested.getByRole('button', { name: new RegExp(`^${escapeRe(name)}\\b`) });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
  }
  await shoot?.('welcome-stars');
  await page.getByTestId('finish-onboarding').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('lane-perfect')).toBeVisible();

  if (o.starsLater?.length) {
    await page.getByRole('navigation', { name: 'Main' }).locator('a:visible', { hasText: /^Stars$/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Stars', exact: true })).toBeVisible();
    for (const name of o.starsLater) {
      await page.locator('#company-search').fill(name);
      const row = page.getByRole('list', { name: 'Companies' }).getByRole('listitem').filter({ hasText: name }).first();
      await row.getByRole('button', { name: /Star/ }).click();
      await expect(row.getByRole('button', { name: /Starred/ })).toBeVisible();
    }
    await page.locator('#company-search').fill('');
    await page.getByRole('navigation', { name: 'Main' }).locator('a:visible', { hasText: /^Home$/ }).first().click();
    await expect(page.getByTestId('lane-perfect')).toBeVisible();
  }
}
