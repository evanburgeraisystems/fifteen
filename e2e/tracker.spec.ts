/**
 * Tracker interactions that the persona journeys do not cover: drag and drop (mouse and keyboard),
 * the Move-to select, notes, and the industry filter chips.
 */
import type { Page } from '@playwright/test';
import { card, clickTab, lane, openJob, returnFromPopup, trackerCard } from './helpers/app.ts';
import { expect, test } from './helpers/fixtures.ts';
import { onboard, type OnboardOptions } from './helpers/onboard.ts';

const PRIYA: OnboardOptions = {
  resume: 'junior-priya.pdf',
  classYear: 'Junior',
  industries: ['Finance'],
  careers: ['Investment Banking'],
  cities: ['New York'],
  forwarding: 'skip',
  stars: [],
};

async function applyTo(page: Page, id: string): Promise<void> {
  const popup = await openJob(page, id);
  await returnFromPopup(page, popup);
  await page.getByTestId('return-prompt').getByRole('button', { name: 'Yes' }).click();
  await expect(card(page, id).locator('.status-applied')).toBeVisible();
}

/** Applies to two roles and returns their ids, newest application first. */
async function twoApplied(page: Page): Promise<[string, string]> {
  const ids = await lane(page, 'perfect')
    .locator('article.job')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-posting-id') ?? ''));
  const more = await lane(page, 'almost')
    .locator('article.job')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-posting-id') ?? ''));
  const pool = [...ids, ...more];
  const [a, b] = [pool[0] ?? '', pool[1] ?? ''];
  expect(a).not.toBe('');
  expect(b).not.toBe('');
  await applyTo(page, a);
  await applyTo(page, b);
  await clickTab(page, 'Tracker');
  await expect(page.getByTestId('col-applied').locator('[data-testid^="card-"]')).toHaveCount(2);
  // Newest first: that card sits at the top of the Applied column, level with the other columns.
  return [b, a];
}

test.describe('Tracker', () => {
  test('mouse drag moves a card between columns', async ({ page, shots }) => {
    const shoot = shots('tracker-drag');
    await onboard(page, PRIYA);
    const [a] = await twoApplied(page);
    await shoot('before');

    const grip = trackerCard(page, a).getByRole('button', { name: /^Drag / });
    // Assessment sits next to Applied on desktop and directly below it on a phone, so it is on screen in both.
    const target = page.getByTestId('col-assessment');
    await grip.scrollIntoViewIfNeeded();
    const from = (await grip.boundingBox())!;
    const to = (await target.boundingBox())!;
    const sx = from.x + from.width / 2;
    const sy = from.y + from.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    // dnd-kit's pointer sensor needs a few pixels of travel before it starts a drag.
    await page.mouse.move(sx + 12, sy + 12, { steps: 4 });
    await page.mouse.move(to.x + to.width / 2, to.y + Math.min(to.height / 2, 60), { steps: 25 });
    await expect(target).toHaveClass(/is-over/);
    await page.mouse.up();

    await expect(page.getByTestId('col-assessment').getByTestId(`card-${a}`)).toBeVisible();
    await expect(page.getByTestId('col-applied').getByTestId(`card-${a}`)).toHaveCount(0);
    await expect(page.getByTestId('col-assessment').locator('.lane-count')).toHaveText('1');
    await shoot('after');

    // The move survives a reload.
    await page.reload();
    await expect(page.getByTestId('col-assessment').getByTestId(`card-${a}`)).toBeVisible();
  });

  test('keyboard drag: one arrow press moves a card one whole column, even the lowest card', async ({ page, shots }) => {
    const shoot = shots('tracker-keyboard');
    await onboard(page, PRIYA);
    // The second id is the LOWER card in the Applied column: it used to be unable to reach an empty column.
    const [, low] = await twoApplied(page);

    const grip = trackerCard(page, low).getByRole('button', { name: /^Drag / });
    await grip.focus();
    await expect(grip).toBeFocused();
    await page.keyboard.press('Space');
    await expect(grip).toHaveAttribute('aria-pressed', 'true');
    const assessment = page.getByTestId('col-assessment');
    // Columns sit side by side on desktop and stack on a phone; either arrow direction works.
    const stacked = ((await assessment.boundingBox())?.y ?? 0) > ((await page.getByTestId('col-applied').boundingBox())?.y ?? 0) + 20;
    await page.keyboard.press(stacked ? 'ArrowDown' : 'ArrowRight');
    await expect(assessment).toHaveClass(/is-over/);
    await page.keyboard.press('Space');

    await expect(page.getByTestId('col-assessment').getByTestId(`card-${low}`)).toBeVisible();
    await expect(page.getByTestId('col-applied').getByTestId(`card-${low}`)).toHaveCount(0);
    await shoot('keyboard-dropped');
  });

  test('Move-to select, undo toast, notes and the denied key', async ({ page, shots }) => {
    const shoot = shots('tracker-select');
    await onboard(page, PRIYA);
    const [a, b] = await twoApplied(page);

    const select = trackerCard(page, a).getByRole('combobox', { name: /^Move .* to$/ });
    await expect(select).toHaveValue('applied');
    await select.selectOption({ label: 'Assessment' });
    await expect(page.getByTestId('col-assessment').getByTestId(`card-${a}`)).toBeVisible();
    // Moving by hand is not an email move.
    await expect(trackerCard(page, a).getByTestId('moved-by-email')).toHaveCount(0);
    await page.getByRole('status').getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('col-applied').getByTestId(`card-${a}`)).toBeVisible();

    // Notes persist on the card.
    await trackerCard(page, b).getByRole('button', { name: 'Add note' }).click();
    await page.getByRole('textbox', { name: /^Notes for/ }).fill('Recruiter: Dana. Superday next week.');
    await page.reload();
    await expect(page.getByRole('textbox', { name: /^Notes for/ })).toHaveValue('Recruiter: Dana. Superday next week.');

    // Denied by hand also keeps the role off Home and Every Job Listing.
    await trackerCard(page, b).getByRole('combobox', { name: /^Move .* to$/ }).selectOption({ label: 'Denied' });
    await expect(page.getByTestId('col-denied').getByTestId(`card-${b}`)).toBeVisible();
    await clickTab(page, 'Home');
    await expect(page.locator(`[data-posting-id="${b}"]`)).toHaveCount(0);
    await clickTab(page, 'Every Job Listing');
    await expect(page.locator('.result-count')).toBeVisible();
    await expect(page.locator(`[data-posting-id="${b}"]`)).toHaveCount(0);
    await shoot('denied-hidden');
  });

  test('empty Tracker explains itself', async ({ page, shots }) => {
    await onboard(page, PRIYA);
    await clickTab(page, 'Tracker');
    await expect(page.getByRole('heading', { name: 'Nothing tracked yet' })).toBeVisible();
    await shots('tracker-empty')('empty');
  });
});
