import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMAIL_FIXTURES } from '../../core/email/fixtures.ts';
import type { HistoryFile, Posting, Snapshot } from '../../core/types.ts';
import { buildDataset } from '../data/dataset.ts';
import { ingestEmail } from './email-ingest.ts';
import { actions, applyPosting, getState, initialState, moveTrackerCard, resetState } from './store.ts';

const snap = JSON.parse(readFileSync(new URL('../../../public/data/demo/latest.json', import.meta.url), 'utf8')) as Snapshot;
const hist = JSON.parse(readFileSync(new URL('../../../public/data/demo/history.json', import.meta.url), 'utf8')) as HistoryFile;
const ds = buildDataset('demo', snap, hist);
const NOW = '2026-10-15T15:00:00.000Z';

function find(company: string, title: RegExp): Posting {
  const p = ds.visible.find((x) => x.company === company && title.test(x.title));
  if (!p) throw new Error(`no ${company} ${title}`);
  return p;
}

const email = (id: string) => {
  const e = EMAIL_FIXTURES.find((x) => x.id === id);
  if (!e) throw new Error(`no fixture ${id}`);
  return e;
};

beforeEach(() => resetState());

describe('denied roles never repopulate', () => {
  it('denial records the dedupe key, which also hides reposts with new ids', () => {
    const p = ds.visible[0];
    if (!p) throw new Error('empty');
    let s = applyPosting(initialState(), p, NOW, 'user');
    s = moveTrackerCard(s, p.id, 'denied', NOW, 'user');
    expect(s.deniedKeys).toEqual([p.dedupeKey]);
    const repost: Posting = { ...p, id: `${p.id}-repost`, externalId: 'NEW-1', title: `${p.title} (Hybrid)` };
    const denied = new Set(s.deniedKeys);
    const visible = [p, repost].filter((x) => !denied.has(x.dedupeKey));
    expect(visible).toHaveLength(0);
  });

  it('moving a card out of Denied restores the role', () => {
    const p = ds.visible[1];
    if (!p) throw new Error('empty');
    let s = applyPosting(initialState(), p, NOW, 'user');
    s = moveTrackerCard(s, p.id, 'denied', NOW, 'user');
    s = moveTrackerCard(s, p.id, 'interview', NOW, 'user');
    expect(s.deniedKeys).toEqual([]);
  });
});

describe('Opened -> Applied', () => {
  it('via the return prompt (user confirms)', () => {
    const p = find('Peachtree Brands', /Marketing Intern/);
    actions.markOpened(p.id, NOW);
    expect(getState().statuses[p.id]?.status).toBe('opened');
    actions.markApplied(p, NOW);
    expect(getState().statuses[p.id]?.status).toBe('applied');
    expect(getState().tracker[p.id]?.stage).toBe('applied');
  });

  it('opening a link never downgrades an applied role', () => {
    const p = find('Peachtree Brands', /Marketing Intern/);
    actions.markApplied(p, NOW);
    actions.markOpened(p.id, NOW);
    expect(getState().statuses[p.id]?.status).toBe('applied');
  });

  it('via a forwarded confirmation email, then stage moves, with undo', async () => {
    const pt = find('Peachtree Brands', /^Marketing Intern/);
    const mg = find('Magnolia Media Group', /Brand Marketing Intern/);
    const lk = find('Larkspur Consumer Co.', /Social Media Marketing Intern/);
    for (const p of [pt, mg, lk]) actions.markOpened(p.id, NOW);

    const applied = await ingestEmail(email('peachtree-applied-greenhouse'), ds);
    expect(applied.result).toBe('applied');
    expect(getState().tracker[pt.id]?.stage).toBe('applied');
    expect(getState().tracker[pt.id]?.movedByEmail).not.toBeNull();

    const assess = await ingestEmail(email('magnolia-assessment-lever'), ds);
    expect(assess.postingId).toBe(mg.id);
    expect(getState().tracker[mg.id]?.stage).toBe('assessment');

    const reject = await ingestEmail(email('larkspur-rejection-ashby'), ds);
    expect(reject.postingId).toBe(lk.id);
    expect(getState().tracker[lk.id]?.stage).toBe('denied');
    expect(getState().deniedKeys).toContain(lk.dedupeKey);

    const interview = await ingestEmail(email('peachtree-interview-invite'), ds);
    expect(interview.result).toBe('moved');
    expect(getState().tracker[pt.id]?.stage).toBe('interview');

    actions.undoEmail(interview.id);
    expect(getState().tracker[pt.id]?.stage).toBe('applied');
    actions.undoEmail(reject.id);
    expect(getState().deniedKeys).not.toContain(lk.dedupeKey);
  });

  it('non-recruiting emails change nothing', async () => {
    const r = await ingestEmail(email('linkedin-job-alert'), ds);
    expect(r.result).toBe('ignored');
    expect(Object.keys(getState().tracker)).toHaveLength(0);
  });
});
