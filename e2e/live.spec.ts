/**
 * Live data: every link a student can click must be the employer's own posting that resolved on the
 * latest real pull. Only meaningful when a live snapshot has been pulled into the repo.
 */
import type { Page } from '@playwright/test';
import { clickTab, lane } from './helpers/app.ts';
import { loadSnapshot, snapshotExists, SNAPSHOT_PATHS } from './helpers/data.ts';
import { expect, test } from './helpers/fixtures.ts';
import { onboard } from './helpers/onboard.ts';

const AGGREGATORS = ['linkedin', 'indeed', 'glassdoor', 'ziprecruiter', 'handshake', 'simplify', 'wayup'];

test.describe('live data links', () => {
  if (!snapshotExists('live')) {
    test('the live snapshot is missing, so there is nothing to link-check', () => {
      const path = SNAPSHOT_PATHS.live;
      console.info(`[live] ${path} does not exist. Run \`npm run pull\` to create it; the live link check needs it.`);
      expect(snapshotExists('live'), `${path} is absent`).toBe(false);
    });
    return;
  }

  async function visibleHrefs(page: Page): Promise<{ id: string; href: string }[]> {
    return page.locator('article.job').evaluateAll((els) =>
      els.map((e) => ({
        id: e.getAttribute('data-posting-id') ?? '',
        href: (e.querySelector('h3.job-title a') as HTMLAnchorElement | null)?.href ?? '',
      })),
    );
  }

  test('every visible link is a verified, direct, https employer posting', async ({ page }) => {
    const snap = loadSnapshot('live');
    const byUrl = new Map(snap.postings.map((p) => [p.applyUrl, p]));

    await onboard(page, {
      resume: 'junior-priya.pdf',
      classYear: 'Junior',
      industries: ['Finance', 'Consumer & Retail', 'Technology', 'Consulting'],
      careers: ['Investment Banking', 'Consulting', 'Marketing', 'Operations', 'Business Analytics'],
      cities: ['New York', 'SF Bay Area', 'Chicago', 'Remote'],
      forwarding: 'skip',
      stars: [],
      dataset: 'live',
    });
    await expect(page.getByTestId('demo-label')).toHaveCount(0);

    const seen: { where: string; id: string; href: string }[] = [];
    const collect = async (where: string) => {
      for (const r of await visibleHrefs(page)) seen.push({ where, ...r });
    };

    // Home: expand every lane.
    for (const tier of ['perfect', 'almost', 'weak', 'nonfit'] as const) {
      const more = lane(page, tier).getByRole('button', { name: /^Show \d+/ });
      while (await more.count()) await more.click();
    }
    await collect('Home');

    // Every Job Listing: page through everything.
    await clickTab(page, 'Every Job Listing');
    const more = page.getByRole('button', { name: /^Show \d+ more/ });
    while (await more.count()) await more.click();
    await expect(page.locator('.result-count')).toContainText(/Showing all/);
    await collect('Every Job Listing');

    expect(seen.length, 'job cards are listed').toBeGreaterThan(0);
    for (const { where, href, id } of seen) {
      const u = new URL(href);
      expect(u.protocol, `${where}: ${href} is https`).toBe('https:');
      const host = u.hostname.toLowerCase();
      for (const bad of AGGREGATORS) expect(host, `${where}: ${href} is not on ${bad}`).not.toContain(bad);
      const p = byUrl.get(href);
      expect(p, `${where}: ${href} is an applyUrl in the live latest.json`).toBeTruthy();
      if (!p) continue;
      expect(p.id, `${where}: card id matches the posting for ${href}`).toBe(id);
      expect(p.linkStatus, `${where}: ${href} linkStatus`).toBe('ok');
      expect(p.linkVerifiedAt?.slice(0, 10), `${where}: ${href} verified on the latest pull`).toBe(snap.date);
    }
  });
});
