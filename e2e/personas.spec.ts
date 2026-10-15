/**
 * Persona journeys on the demo dataset (fictional companies, today pinned to 2026-10-15).
 * Each one onboards with a real resume file and then uses the app the way that student would.
 */
import type { Page } from '@playwright/test';
import {
  card,
  clickSettings,
  clickTab,
  lane,
  LANES,
  openJob,
  pasteEmail,
  pressTab,
  returnFromPopup,
  searchJobs,
  trackerCard,
  type Lane,
} from './helpers/app.ts';
import { findPosting, loadSnapshot, visiblePostings } from './helpers/data.ts';
import { expect, test, type Shoot } from './helpers/fixtures.ts';
import { onboard, type OnboardOptions } from './helpers/onboard.ts';

const prompt = (page: Page) => page.getByTestId('return-prompt');

async function laneCount(page: Page, tier: Lane): Promise<number> {
  const label = await lane(page, tier).locator('.lane-count').getAttribute('aria-label');
  return Number(/^(\d+) roles$/.exec(label ?? '')?.[1]);
}

async function idsIn(loc: ReturnType<Page['locator']>): Promise<string[]> {
  return loc.locator('article.job').evaluateAll((els) => els.map((e) => e.getAttribute('data-posting-id') ?? ''));
}

/** Open a role, come back, and answer the prompt. Leaves the app tab in front. */
async function openAndReturn(page: Page, postingId: string): Promise<void> {
  const popup = await openJob(page, postingId);
  await expect(card(page, postingId).locator('.status-opened')).toHaveText('Opened');
  await returnFromPopup(page, popup);
  await expect(prompt(page)).toBeVisible();
  await expect(prompt(page)).toContainText(findTitle(postingId));
}

function findTitle(postingId: string): string {
  const p = loadSnapshot('demo').postings.find((x) => x.id === postingId);
  if (!p) throw new Error(`unknown posting ${postingId}`);
  return p.title;
}

async function confirmWithPrompt(page: Page, postingId: string): Promise<void> {
  await openAndReturn(page, postingId);
  await prompt(page).getByRole('button', { name: 'Yes' }).click();
  await expect(prompt(page)).toHaveCount(0);
  await expect(card(page, postingId).locator('.status-applied')).toContainText('Applied');
}

// ---------------------------------------------------------------------------------------------

const MAYA: OnboardOptions = {
  resume: 'freshman-maya.pdf',
  classYear: 'Freshman',
  industries: ['Finance', 'Consulting'],
  careers: ['Investment Banking', 'Consulting', 'Asset Management'],
  cities: ['New York', 'Remote'],
  forwarding: 'skip',
  stars: ['Northwind Capital'],
  // Halcyon is not among the twelve onboarding suggestions for these targets, so Maya stars it from Stars.
  starsLater: ['Halcyon Advisory'],
};

test.describe('1. Freshman Maya (Finance + Consulting, skips forwarding)', () => {
  test('Home populates and obeys the fit rules', async ({ page, shots }) => {
    const shoot = shots('maya-home');
    await onboard(page, MAYA, shoot);
    await expect(page.getByTestId('demo-label')).toHaveText('Demo data');
    await shoot('home');

    // Four lanes, each with a count that matches what is listed (a lane lists 8 before "Show more").
    for (const tier of LANES) {
      await expect(lane(page, tier)).toBeVisible();
      const count = await laneCount(page, tier);
      expect(count, `${tier} lane has roles`).toBeGreaterThan(0);
      await expect(lane(page, tier).locator('article.job')).toHaveCount(Math.min(count, 8));
    }

    // The tier legend is explained once, not once per card.
    await expect(page.getByTestId('tier-legend')).toHaveCount(1);
    await expect(page.getByText('your resume covers what they ask for')).toHaveCount(1);

    // The season strip is scoped to an industry she picked.
    await expect(page.getByTestId('season-strip')).toHaveText(/Finance|Consulting/);

    // Class year is fit, not a filter: ineligible roles sit in Non-fit with a tag, and never in a better lane.
    for (const tier of ['perfect', 'almost', 'weak'] as const) {
      await expect(lane(page, tier).locator('.tag-ineligible'), `no ineligible role in ${tier}`).toHaveCount(0);
      await expect(page.locator(`article.job[data-tier="${tier}"]`).filter({ hasText: 'Not eligible yet' })).toHaveCount(0);
    }
    const tagged = lane(page, 'nonfit').locator('article.job', { hasText: 'Not eligible yet' });
    expect(await tagged.count(), 'ineligible roles are listed in Non-fit').toBeGreaterThan(0);

    // They never disappear: the same role is in Every Job Listing as Non-fit, still tagged.
    const target = tagged.first();
    const id = (await target.getAttribute('data-posting-id')) ?? '';
    const title = (await target.locator('h3.job-title a').textContent()) ?? '';
    expect(id).not.toBe('');
    await clickTab(page, 'Every Job Listing');
    await page.locator('#job-search').fill(title);
    const listed = card(page, id);
    await expect(listed).toBeVisible();
    await expect(listed).toHaveAttribute('data-tier', 'nonfit');
    await expect(listed).toContainText('Not eligible yet');
    await expect(listed.locator('.fit-badge')).toContainText('Non-fit');
    await shoot('jobs-ineligible');
  });

  test('New Stars glow per trigger, clear one card at a time, and persist', async ({ page, shots }) => {
    const shoot = shots('maya-stars');
    await onboard(page, MAYA, shoot);

    const northwind = page.getByTestId('star-northwind-capital');
    const halcyon = page.getByTestId('star-halcyon-advisory');
    await expect(northwind).toHaveAttribute('data-glowing', 'true');
    await expect(halcyon).toHaveAttribute('data-glowing', 'true');
    // Northwind: new roles and deadlines. Halcyon: its consulting window is about to open.
    await expect(northwind).toContainText(/new role/);
    await expect(northwind).toContainText(/deadline/);
    await expect(halcyon).toContainText(/opens ~Oct 19/);
    await shoot('both-glowing');

    // Clicking one glowing card clears only that card.
    await northwind.click();
    await expect(northwind).toHaveAttribute('data-glowing', 'false');
    await expect(halcyon).toHaveAttribute('data-glowing', 'true');
    await shoot('northwind-cleared');

    // And it stays cleared after a reload; the other one is still lit.
    await page.reload();
    await expect(page.getByTestId('star-northwind-capital')).toHaveAttribute('data-glowing', 'false');
    await expect(page.getByTestId('star-halcyon-advisory')).toHaveAttribute('data-glowing', 'true');

    // Clicking the second clears it too.
    await page.getByTestId('star-halcyon-advisory').click();
    await expect(page.getByTestId('star-halcyon-advisory')).toHaveAttribute('data-glowing', 'false');
    await expect(page.getByTestId('star-northwind-capital')).toHaveAttribute('data-glowing', 'false');
  });

  test('Opened, return prompt (Yes / Not yet) and the tray tick', async ({ page, shots }) => {
    const shoot = shots('maya-apply');
    await onboard(page, MAYA, shoot);

    const first = (await idsIn(lane(page, 'perfect')))[0] ?? '';
    const second = (await idsIn(lane(page, 'almost')))[0] ?? '';
    expect(first).not.toBe('');
    expect(second).not.toBe('');
    expect(second).not.toBe(first);
    const [firstTitle, secondTitle] = [findTitle(first), findTitle(second)];

    // First role: link opens the posting, card shows Opened, coming back asks, "Yes" lands it in Applied.
    const popup = await openJob(page, first);
    await expect(popup).toHaveURL(new RegExp(`/demo-posting/`));
    // The link lands on the posting itself, not on an error page.
    await expect(popup.getByRole('heading', { level: 1, name: firstTitle })).toBeVisible();
    await expect(card(page, first).locator('.status-opened')).toHaveText('Opened');
    await shoot('first-opened');
    await returnFromPopup(page, popup);
    await expect(prompt(page)).toBeVisible();
    await expect(prompt(page)).toContainText(firstTitle);
    await shoot('prompt');
    await prompt(page).getByRole('button', { name: 'Yes' }).click();
    await expect(prompt(page)).toHaveCount(0);
    await expect(card(page, first).locator('.status-applied')).toContainText('Applied');

    await clickTab(page, 'Tracker');
    await expect(page.getByTestId('col-applied')).toContainText(firstTitle);
    await expect(trackerCard(page, first)).toBeVisible();
    await shoot('tracker-applied');

    // Second role: "Not yet" makes the prompt go away and leaves the role in the Opened tray.
    await clickTab(page, 'Home');
    await openAndReturn(page, second);
    await shoot('prompt-second');
    await prompt(page).getByRole('button', { name: 'Not yet' }).click();
    await expect(prompt(page)).toHaveCount(0);
    await expect(card(page, second).locator('.status-opened')).toHaveText('Opened');

    await clickTab(page, 'Tracker');
    const tray = page.getByTestId('opened-tray');
    await expect(tray).toContainText(secondTitle);
    await expect(page.getByTestId('col-applied')).not.toContainText(secondTitle);
    await shoot('tray');
    await tray.getByRole('button', { name: /^Confirm applied/ }).click();
    await expect(page.getByTestId('col-applied')).toContainText(secondTitle);
    await expect(page.getByTestId('opened-tray')).toHaveCount(0);
    await expect(page.getByTestId('col-applied')).toContainText(firstTitle);
    await shoot('tray-confirmed');
  });
});

// ---------------------------------------------------------------------------------------------

const JORDAN: OnboardOptions = {
  resume: 'sophomore-jordan.docx',
  classYear: 'Sophomore',
  industries: ['Consumer & Retail', 'Media & Entertainment'],
  careers: ['Marketing'],
  cities: ['Atlanta'],
  forwarding: 'connect',
  stars: ['Peachtree Brands'],
};

const JORDAN_ROLES = {
  peachtree: { company: 'Peachtree Brands', title: 'Marketing Intern, Partnerships' },
  magnolia: { company: 'Magnolia Media Group', title: 'Brand Marketing Intern - Summer 2027' },
  larkspur: { company: 'Larkspur Consumer Co.', title: 'Social Media Marketing Intern - Summer 2027' },
} as const;

/** Opens each of the three roles from Every Job Listing, leaving them in the Opened state. */
async function openJordansRoles(page: Page, shoot: Shoot): Promise<Record<keyof typeof JORDAN_ROLES, string>> {
  const ids = {} as Record<keyof typeof JORDAN_ROLES, string>;
  for (const key of Object.keys(JORDAN_ROLES) as (keyof typeof JORDAN_ROLES)[]) {
    const r = JORDAN_ROLES[key];
    ids[key] = await searchJobs(page, 'demo', r.company, r.title);
    const popup = await openJob(page, ids[key]);
    await returnFromPopup(page, popup);
    await expect(prompt(page)).toBeVisible();
    await prompt(page).getByRole('button', { name: 'Not yet' }).click();
    await expect(prompt(page)).toHaveCount(0);
    await expect(card(page, ids[key]).locator('.status-opened')).toHaveText('Opened');
  }
  await shoot('three-opened');
  return ids;
}

test.describe('2. Sophomore Jordan (DOCX resume, connects forwarding)', () => {
  test('forwarded emails move the cards, undo reverts, and a denied role never comes back', async ({ page, shots }) => {
    const shoot = shots('jordan');
    await onboard(page, JORDAN, shoot);
    await shoot('home');
    const ids = await openJordansRoles(page, shoot);

    // Peachtree "thanks for applying" -> Applied, tagged as moved by email.
    await pasteEmail(page, 'peachtree-applied-greenhouse');
    await pressTab(page, 'Tracker');
    await expect(page.getByTestId('col-applied').getByTestId(`card-${ids.peachtree}`)).toBeVisible();
    await expect(trackerCard(page, ids.peachtree).getByTestId('moved-by-email')).toBeVisible();
    await shoot('applied-by-email');

    // Magnolia assessment link -> Assessment.
    await pasteEmail(page, 'magnolia-assessment-lever');
    await pressTab(page, 'Tracker');
    await expect(page.getByTestId('col-assessment').getByTestId(`card-${ids.magnolia}`)).toBeVisible();
    await expect(trackerCard(page, ids.magnolia).getByTestId('moved-by-email')).toBeVisible();

    // Larkspur rejection -> Denied.
    await pasteEmail(page, 'larkspur-rejection-ashby');
    await pressTab(page, 'Tracker');
    await expect(page.getByTestId('col-denied').getByTestId(`card-${ids.larkspur}`)).toBeVisible();
    await expect(trackerCard(page, ids.larkspur).getByTestId('moved-by-email')).toBeVisible();

    // Peachtree interview invite -> Interview.
    await pasteEmail(page, 'peachtree-interview-invite');
    await pressTab(page, 'Tracker');
    await expect(page.getByTestId('col-interview').getByTestId(`card-${ids.peachtree}`)).toBeVisible();
    await expect(page.getByTestId('col-applied').getByTestId(`card-${ids.peachtree}`)).toHaveCount(0);
    await shoot('all-four-moves');

    // Undo the interview move: the card goes back to where it was.
    await trackerCard(page, ids.peachtree).getByRole('button', { name: /^Undo email move/ }).click();
    await expect(page.getByTestId('col-applied').getByTestId(`card-${ids.peachtree}`)).toBeVisible();
    await expect(page.getByTestId('col-interview').getByTestId(`card-${ids.peachtree}`)).toHaveCount(0);
    await shoot('after-undo');

    // The denied role never repopulates: not on Home, not in Every Job Listing, and neither is any repost
    // that shares its dedupe key (company + normalized title + cycle).
    const denied = findPosting('demo', JORDAN_ROLES.larkspur.company, JORDAN_ROLES.larkspur.title);
    const sameKey = visiblePostings('demo').filter((p) => p.dedupeKey === denied.dedupeKey);
    expect(sameKey.map((p) => p.id)).toContain(denied.id);

    await clickTab(page, 'Home');
    await expect(lane(page, 'perfect')).toBeVisible();
    for (const p of sameKey) await expect(page.locator(`[data-posting-id="${p.id}"]`)).toHaveCount(0);
    await expect(page.locator('article.job', { hasText: denied.title })).toHaveCount(0);
    await shoot('home-after-denial');

    await clickTab(page, 'Every Job Listing');
    await page.locator('#job-search').fill(`${denied.company} Social Media Marketing`);
    await expect(page.locator('.result-count')).toContainText(/match/);
    const titles = await page.locator('article.job').evaluateAll((els) =>
      els.map((e) => `${e.querySelector('.job-company')?.textContent} | ${e.querySelector('h3.job-title')?.textContent}`),
    );
    expect(titles.length).toBeGreaterThan(0); // other companies' social media roles are still listed
    for (const p of sameKey) await expect(page.locator(`[data-posting-id="${p.id}"]`)).toHaveCount(0);
    expect(titles).not.toContain(`${denied.company} | ${denied.title}`);
    await shoot('jobs-after-denial');
  });

  test('a repost with a new id and the same dedupe key stays hidden after a denial', async ({ page, shots }) => {
    const shoot = shots('jordan-repost');
    await onboard(page, JORDAN, shoot);
    const larkspur = JORDAN_ROLES.larkspur;
    const id = await searchJobs(page, 'demo', larkspur.company, larkspur.title);
    const popup = await openJob(page, id);
    await returnFromPopup(page, popup);
    await prompt(page).getByRole('button', { name: 'Not yet' }).click();
    await pasteEmail(page, 'larkspur-rejection-ashby');
    await pressTab(page, 'Tracker');
    await expect(page.getByTestId('col-denied').getByTestId(`card-${id}`)).toBeVisible();

    // The company reposts the same role under a new id, and an unrelated role is reposted too (control).
    const original = findPosting('demo', larkspur.company, larkspur.title);
    const control = findPosting('demo', 'Peachtree Brands', 'Marketing Intern, Brand');
    const repostId = `${original.id}-repost`;
    const controlId = `${control.id}-repost`;
    await page.route('**/data/demo/latest.json', async (route) => {
      const res = await route.fetch();
      const snap = (await res.json()) as { postings: unknown[] };
      snap.postings.push(
        { ...original, id: repostId, externalId: `${original.externalId}-repost` },
        { ...control, id: controlId, externalId: `${control.externalId}-repost`, dedupeKey: `${control.dedupeKey}-other` },
      );
      await route.fulfill({ response: res, json: snap });
    });
    await page.reload();
    await clickTab(page, 'Every Job Listing');
    await page.locator('#job-search').fill(`${control.company} ${control.title}`);
    await expect(page.locator('.result-count')).toBeVisible();
    // The control repost (different key) is listed, so the injected data really reached the app.
    await expect(page.locator(`[data-posting-id="${controlId}"]`)).toHaveCount(1);
    await page.locator('#job-search').fill(`${original.company} Social Media Marketing`);
    await expect(page.locator('article.job').first()).toBeVisible(); // other Larkspur social roles are still listed
    await expect(page.locator(`[data-posting-id="${repostId}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-posting-id="${id}"]`)).toHaveCount(0);
    await clickTab(page, 'Home');
    await expect(page.locator(`[data-posting-id="${repostId}"]`)).toHaveCount(0);
    await shoot('home-after-repost');
  });
});

// ---------------------------------------------------------------------------------------------

test.describe('3. Junior Sam (Operations targets, applies to Supply Chain)', () => {
  test('three Supply Chain applications offer to add Supply Chain to targets', async ({ page, shots }) => {
    const shoot = shots('sam');
    await onboard(
      page,
      {
        resume: 'junior-sam.pdf',
        classYear: 'Junior',
        industries: ['Industrials', 'Consumer & Retail'],
        careers: ['Operations'],
        cities: ['Chicago'],
        forwarding: 'skip',
        stars: [],
      },
      shoot,
    );
    await shoot('home');

    await clickTab(page, 'Every Job Listing');
    await page.locator('#job-search').fill('supply chain');
    await expect(page.locator('.result-count')).toContainText(/match/);
    const careerOf = new Map(visiblePostings('demo').map((p) => [p.id, p.classification.career]));
    const listed = await idsIn(page.locator('main'));
    const supplyChain = listed.filter((id) => careerOf.get(id) === 'supply-chain').slice(0, 3);
    expect(supplyChain, 'three Supply Chain roles come up for "supply chain"').toHaveLength(3);
    await expect(page.getByTestId('add-target-suggestion')).toHaveCount(0);
    await shoot('search');

    // Two confirmed with the return prompt, one with the tray tick.
    await confirmWithPrompt(page, supplyChain[0] ?? '');
    await confirmWithPrompt(page, supplyChain[1] ?? '');
    await expect(page.getByTestId('add-target-suggestion')).toHaveCount(0);

    const third = supplyChain[2] ?? '';
    const popup = await openJob(page, third);
    await returnFromPopup(page, popup);
    await prompt(page).getByRole('button', { name: 'Not yet' }).click();
    await clickTab(page, 'Tracker');
    await page.getByTestId('opened-tray').getByRole('button', { name: /^Confirm applied/ }).click();
    for (const id of supplyChain) await expect(trackerCard(page, id)).toBeVisible();

    await clickTab(page, 'Every Job Listing');
    const banner = page.getByTestId('add-target-suggestion');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Supply Chain');
    await shoot('suggestion');
    await banner.getByRole('button', { name: 'Add to targets' }).click();
    await expect(banner).toHaveCount(0);

    await clickSettings(page);
    const careers = page.getByRole('group', { name: /^Careers/ });
    await expect(careers.getByRole('button', { name: 'Supply Chain', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(careers.getByRole('button', { name: 'Operations', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await shoot('settings-targets');
  });
});

// ---------------------------------------------------------------------------------------------

const PRIYA: OnboardOptions = {
  resume: 'junior-priya.pdf',
  classYear: 'Junior',
  industries: ['Finance'],
  careers: ['Investment Banking'],
  cities: ['New York'],
  forwarding: 'skip',
  stars: ['Northwind Capital'],
};

test.describe('4. Zero-new-roles day (demo-zero)', () => {
  test('says so calmly, keeps the lanes, and stays quiet in notifications', async ({ page, shots }) => {
    const shoot = shots('zero-day');
    // No stars: a starred company with a deadline coming is its own, legitimate, notification.
    await onboard(page, { ...PRIYA, stars: [], dataset: 'demo-zero' }, shoot);
    await shoot('home');

    const zero = page.getByTestId('zero-day');
    await expect(zero).toBeVisible();
    await expect(zero).toHaveText(/^No new roles today\./);
    // Season context follows the sentence: the industry she picked and where its season stands.
    await expect(zero).toContainText(/Finance/);
    await expect(zero).toContainText(/season|window|opens|closed|peak|late|early/i);
    for (const n of ['perfect', 'almost', 'weak']) await expect(page.getByTestId(`new-${n}`)).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(/\b0 new\b/i);

    // Lanes still show roles.
    let total = 0;
    for (const tier of LANES) total += await laneCount(page, tier);
    expect(total).toBeGreaterThan(0);
    await expect(page.locator('article.job').first()).toBeVisible();
    await expect(page.getByTestId('tier-legend')).toHaveCount(1);

    // The notification preview says none today, never "0 new".
    await clickSettings(page);
    const preview = page.getByTestId('notification-preview');
    await expect(preview).toContainText(/None today/);
    await expect(preview).not.toContainText(/\b0 new\b/i);
    await expect(preview).not.toContainText(/\b0\b/);
    await shoot('settings-preview');
  });
});

// ---------------------------------------------------------------------------------------------

async function applyToFirstInLane(page: Page, tier: Lane, skip = 0): Promise<string> {
  const id = (await idsIn(lane(page, tier)))[skip] ?? '';
  expect(id).not.toBe('');
  await confirmWithPrompt(page, id);
  return id;
}

async function moveTo(page: Page, postingId: string, stage: 'Applied' | 'Assessment' | 'Interview' | 'Offer' | 'Denied'): Promise<void> {
  await trackerCard(page, postingId).getByRole('combobox', { name: /^Move .* to$/ }).selectOption({ label: stage });
  await expect(page.getByTestId(`col-${stage.toLowerCase()}`).getByTestId(`card-${postingId}`)).toBeVisible();
}

test.describe('5. Season close', () => {
  test('an offer lands: Congrats! with a shareable recap card', async ({ page, context, shots }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const shoot = shots('season-offer');
    await onboard(page, PRIYA, shoot);
    const id = await applyToFirstInLane(page, 'perfect');
    await clickTab(page, 'Tracker');
    await moveTo(page, id, 'Offer');
    await shoot('tracker-offer');

    await page.getByRole('link', { name: 'Wrap up the season' }).click();
    await expect(page.getByRole('heading', { name: 'Congrats!' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Keep going.' })).toHaveCount(0);
    const recap = page.getByRole('img', { name: /^Recap card:/ });
    await expect(recap).toBeVisible();
    const offered = loadSnapshot('demo').postings.find((p) => p.id === id);
    await expect(recap).toContainText(offered?.company ?? 'missing');
    const download = page.getByRole('button', { name: 'Download card' });
    const copy = page.getByRole('button', { name: 'Copy text' });
    await expect(download).toBeVisible();
    await expect(copy).toBeVisible();
    await shoot('congrats');

    await copy.click();
    const note = page.locator('figcaption [role=status]');
    await expect(note).toContainText('Copied.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/interning at .+ this summer/);

    const downloadPromise = page.waitForEvent('download');
    await download.click();
    const file = await downloadPromise;
    expect(file.suggestedFilename()).toMatch(/^fifteen-\d{4}-offer\.png$/);
    await expect(note).toContainText('Saved the card as a PNG.');
  });

  test('no offer: Keep going. is private, with stats and when stars open next', async ({ page, shots }) => {
    const shoot = shots('season-keep-going');
    await onboard(page, PRIYA, shoot);
    const a = await applyToFirstInLane(page, 'perfect');
    const b = await applyToFirstInLane(page, 'almost');
    const c = await applyToFirstInLane(page, 'weak');
    await clickTab(page, 'Tracker');
    await moveTo(page, a, 'Assessment');
    await moveTo(page, b, 'Interview');
    await moveTo(page, c, 'Denied');
    await shoot('tracker');

    await page.getByRole('link', { name: 'Wrap up the season' }).click();
    await expect(page.getByRole('heading', { name: 'Keep going.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Congrats!' })).toHaveCount(0);

    const stats = page.getByRole('list', { name: 'What moved this season' });
    await expect(stats.getByRole('listitem').filter({ hasText: 'applications sent' })).toContainText('3');
    await expect(stats.getByRole('listitem').filter({ hasText: 'assessments reached' })).toContainText('1');
    await expect(stats.getByRole('listitem').filter({ hasText: 'interviews reached' })).toContainText('1');
    await expect(page.getByRole('heading', { name: 'When your stars open next' })).toBeVisible();
    await expect(page.locator('.next-list li').first()).toContainText('Northwind Capital');
    await expect(page.getByRole('button', { name: 'Download card' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy text' })).toHaveCount(0);
    await expect(page.getByRole('img', { name: /^Recap card/ })).toHaveCount(0);
    await shoot('keep-going');
  });
});
