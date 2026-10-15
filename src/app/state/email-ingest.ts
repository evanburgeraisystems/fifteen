/**
 * Forwarded email -> tracker. Classify the email, match it to a role the student
 * opened or is tracking, then confirm the application or move the card, with
 * a "moved by email" tag and an undo entry. The app never reads an inbox; it only
 * sees emails the student chose to forward (or pasted with the dev tool).
 */
import { matchEmailToCard, type MatchCandidate } from '../../core/email/match.ts';
import { shouldMove, stageForEmail } from '../../core/email/stage.ts';
import { getProvider } from '../../core/provider/index.ts';
import type { InboundEmail } from '../../core/types.ts';
import type { Dataset } from '../data/dataset.ts';
import { actions, applyPosting, getState, moveTrackerCard, type EmailLogEntry } from './store.ts';

const provider = getProvider(import.meta.env as Record<string, string | undefined>);

export async function ingestEmail(email: InboundEmail, ds: Dataset): Promise<EmailLogEntry> {
  const s = getState();
  const cls = (await provider.classifyEmail(email)) ?? {
    kind: 'other' as const,
    confidence: 0,
    companyGuess: null,
    roleGuess: null,
    evidence: [],
  };
  const now = ds.nowIso();

  const candidates: MatchCandidate[] = [];
  const seen = new Set<string>();
  for (const c of Object.values(s.tracker)) {
    candidates.push({ postingId: c.postingId, dedupeKey: c.dedupeKey, company: c.company, companySlug: c.companySlug, title: c.title });
    seen.add(c.postingId);
  }
  for (const [id, st] of Object.entries(s.statuses)) {
    if (seen.has(id) || st.status !== 'opened') continue;
    const p = ds.byId.get(id);
    if (p) candidates.push({ postingId: p.id, dedupeKey: p.dedupeKey, company: p.company, companySlug: p.companySlug, title: p.title });
  }

  const base: Omit<EmailLogEntry, 'result' | 'postingId' | 'before' | 'statusBefore'> = {
    id: email.id,
    receivedAt: email.receivedAt,
    from: email.from,
    subject: email.subject,
    kind: cls.kind,
  };

  const stage = stageForEmail(cls.kind);
  if (!stage) {
    const entry: EmailLogEntry = { ...base, result: 'ignored', postingId: null, before: null, statusBefore: null };
    actions.logEmail(entry, null);
    return entry;
  }

  const match = matchEmailToCard(cls, candidates);
  if (!match) {
    const entry: EmailLogEntry = { ...base, result: 'unmatched', postingId: null, before: null, statusBefore: null };
    actions.logEmail(entry, null);
    return entry;
  }

  const before = s.tracker[match.postingId] ?? null;
  const statusBefore = s.statuses[match.postingId] ?? null;
  let next = s;
  let result: EmailLogEntry['result'] = 'no-change';

  if (!before) {
    const posting = ds.byId.get(match.postingId);
    if (posting) {
      next = applyPosting(next, posting, now, 'email');
      const card = next.tracker[posting.id];
      if (card) {
        next = {
          ...next,
          tracker: { ...next.tracker, [posting.id]: { ...card, movedByEmail: { from: null, at: now, emailId: email.id } } },
        };
      }
      result = 'applied';
      if (stage !== 'applied') next = moveTrackerCard(next, posting.id, stage, now, 'email', email.id);
    }
  } else if (shouldMove(before.stage, stage)) {
    next = moveTrackerCard(next, before.postingId, stage, now, 'email', email.id);
    result = 'moved';
  }

  const entry: EmailLogEntry = { ...base, result, postingId: match.postingId, before, statusBefore };
  actions.logEmail(entry, result === 'no-change' ? null : next);
  return entry;
}
