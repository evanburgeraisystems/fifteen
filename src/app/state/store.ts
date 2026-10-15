/**
 * The student's state, persisted to localStorage. One small external store
 * (useSyncExternalStore) instead of a framework: the app has one user and the
 * state is a plain JSON document.
 */
import { useSyncExternalStore } from 'react';
import type {
  EmailKind,
  InboundEmail,
  JobStatus,
  Posting,
  Profile,
  Targets,
  TrackerCard,
  TrackerStage,
} from '../../core/types.ts';
import type { StarState } from '../../core/stars.ts';
import type { NotificationPrefs } from '../../core/notify.ts';

export type Theme = 'system' | 'light' | 'dark';

export interface PostingStatus {
  status: Exclude<JobStatus, 'new'>;
  at: string;
  /** "Not yet" on the return prompt snoozes it until the next return. */
  snoozedAt?: string;
}

export interface EmailLogEntry {
  id: string;
  receivedAt: string;
  from: string;
  subject: string;
  kind: EmailKind;
  postingId: string | null;
  result: 'moved' | 'applied' | 'unmatched' | 'ignored' | 'no-change';
  /** For undo: the card before this email touched it (null = card did not exist). */
  before: TrackerCard | null;
  /** Status before (for undo of an email-confirmed application). */
  statusBefore: PostingStatus | null;
  undone?: boolean;
}

export interface Forwarding {
  status: 'unset' | 'skipped' | 'connected' | 'off';
  address: string;
}

export interface AppState {
  version: 1;
  onboarded: boolean;
  /** Set after onboarding finishes so Home can play the populate moment once. */
  populatePending: boolean;
  profile: Profile | null;
  resumeName: string | null;
  targets: Targets | null;
  forwarding: Forwarding;
  stars: Record<string, StarState & { name: string }>;
  statuses: Record<string, PostingStatus>;
  /** postingId -> visit number when its New badge was first seen. */
  seen: Record<string, number>;
  visit: number;
  tracker: Record<string, TrackerCard>;
  /** Dedupe keys of denied roles: they never repopulate, even as reposts. */
  deniedKeys: string[];
  emails: EmailLogEntry[];
  dismissedSuggestions: string[];
  notifications: NotificationPrefs;
  theme: Theme;
}

let KEY = 'fifteen.state.v1:live';

function randomId(n = 8): string {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((b) => (b % 36).toString(36)).join('');
}

export function initialState(): AppState {
  return {
    version: 1,
    onboarded: false,
    populatePending: false,
    profile: null,
    resumeName: null,
    targets: null,
    forwarding: { status: 'unset', address: `apply-${randomId(6)}@in.fifteen.app` },
    stars: {},
    statuses: {},
    seen: {},
    visit: 0,
    tracker: {},
    deniedKeys: [],
    emails: [],
    dismissedSuggestions: [],
    notifications: { newHits: true, starAlerts: true, weeklyDigest: false },
    theme: 'system',
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (parsed.version !== 1) return initialState();
    return { ...initialState(), ...parsed };
  } catch {
    return initialState();
  }
}

let state: AppState = initialState();
const listeners = new Set<() => void>();

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode: state still lives for this session */
  }
}

/**
 * Each dataset keeps its own saved state, so stars and tracker cards from the
 * fictional demo never appear next to live postings.
 */
export function bindStore(datasetId: string): void {
  KEY = `fifteen.state.v1:${datasetId}`;
  state = load();
  for (const l of listeners) l();
}

export function getState(): AppState {
  return state;
}

export function setState(update: (s: AppState) => AppState): void {
  state = update(state);
  persist();
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

/** For tests and "Reset everything". */
export function resetState(): void {
  setState(() => initialState());
}

// ---------------- actions ----------------

export const actions = {
  beginVisit(): void {
    setState((s) => ({ ...s, visit: s.visit + 1 }));
  },

  setProfile(profile: Profile | null, resumeName: string | null): void {
    setState((s) => ({ ...s, profile, resumeName }));
  },

  setTargets(targets: Targets): void {
    setState((s) => ({ ...s, targets }));
  },

  finishOnboarding(): void {
    setState((s) => ({ ...s, onboarded: true, populatePending: true }));
  },

  consumePopulate(): void {
    setState((s) => ({ ...s, populatePending: false }));
  },

  setForwarding(status: Forwarding['status']): void {
    setState((s) => ({ ...s, forwarding: { ...s.forwarding, status } }));
  },

  setTheme(theme: Theme): void {
    setState((s) => ({ ...s, theme }));
  },

  setNotifications(n: Partial<NotificationPrefs>): void {
    setState((s) => ({ ...s, notifications: { ...s.notifications, ...n } }));
  },

  toggleStar(slug: string, name: string, nowIso: string): void {
    setState((s) => {
      const stars = { ...s.stars };
      if (stars[slug]) delete stars[slug];
      else stars[slug] = { name, starredAt: nowIso, alerts: true, ackAt: null };
      return { ...s, stars };
    });
  },

  setStarAlerts(slug: string, alerts: boolean): void {
    setState((s) => {
      const cur = s.stars[slug];
      if (!cur) return s;
      return { ...s, stars: { ...s.stars, [slug]: { ...cur, alerts } } };
    });
  },

  ackStar(slug: string, nowIso: string): void {
    setState((s) => {
      const cur = s.stars[slug];
      if (!cur) return s;
      return { ...s, stars: { ...s.stars, [slug]: { ...cur, ackAt: nowIso } } };
    });
  },

  markSeen(ids: string[]): void {
    setState((s) => {
      const seen = { ...s.seen };
      let changed = false;
      for (const id of ids) {
        if (seen[id] == null) {
          seen[id] = s.visit;
          changed = true;
        }
      }
      return changed ? { ...s, seen } : s;
    });
  },

  /** Clicking the verified link marks the role Opened (never downgrades Applied). */
  markOpened(postingId: string, nowIso: string): void {
    setState((s) => {
      if (s.statuses[postingId]?.status === 'applied') return s;
      return { ...s, statuses: { ...s.statuses, [postingId]: { status: 'opened', at: nowIso } } };
    });
  },

  snoozePrompt(postingId: string, nowIso: string): void {
    setState((s) => {
      const cur = s.statuses[postingId];
      if (!cur) return s;
      return { ...s, statuses: { ...s.statuses, [postingId]: { ...cur, snoozedAt: nowIso } } };
    });
  },

  /** Remove a role from the Opened tray without applying. */
  dismissOpened(postingId: string): void {
    setState((s) => {
      const statuses = { ...s.statuses };
      if (statuses[postingId]?.status === 'opened') delete statuses[postingId];
      return { ...s, statuses };
    });
  },

  markApplied(posting: Posting, nowIso: string, by: 'user' | 'email' = 'user'): void {
    setState((s) => applyPosting(s, posting, nowIso, by));
  },

  moveCard(postingId: string, stage: TrackerStage, nowIso: string): void {
    setState((s) => moveTrackerCard(s, postingId, stage, nowIso, 'user'));
  },

  setNotes(postingId: string, notes: string): void {
    setState((s) => {
      const card = s.tracker[postingId];
      if (!card) return s;
      return { ...s, tracker: { ...s.tracker, [postingId]: { ...card, notes } } };
    });
  },

  removeCard(postingId: string): void {
    setState((s) => {
      const tracker = { ...s.tracker };
      const card = tracker[postingId];
      delete tracker[postingId];
      const statuses = { ...s.statuses };
      delete statuses[postingId];
      const deniedKeys = card ? s.deniedKeys.filter((k) => k !== card.dedupeKey) : s.deniedKeys;
      return { ...s, tracker, statuses, deniedKeys };
    });
  },

  dismissSuggestion(key: string): void {
    setState((s) => ({ ...s, dismissedSuggestions: [...new Set([...s.dismissedSuggestions, key])] }));
  },

  logEmail(entry: EmailLogEntry, next: AppState | null): void {
    setState((s) => {
      const base = next ?? s;
      return { ...base, emails: [entry, ...base.emails].slice(0, 200) };
    });
  },

  undoEmail(emailId: string): void {
    setState((s) => {
      const e = s.emails.find((x) => x.id === emailId);
      if (!e || e.undone || !e.postingId) return s;
      const tracker = { ...s.tracker };
      const statuses = { ...s.statuses };
      let deniedKeys = s.deniedKeys;
      const cur = tracker[e.postingId];
      if (cur?.stage === 'denied') deniedKeys = deniedKeys.filter((k) => k !== cur.dedupeKey);
      if (e.before) {
        tracker[e.postingId] = e.before;
        if (e.before.stage === 'denied') deniedKeys = [...new Set([...deniedKeys, e.before.dedupeKey])];
      } else delete tracker[e.postingId];
      if (e.statusBefore) statuses[e.postingId] = e.statusBefore;
      else if (!e.before) delete statuses[e.postingId];
      return {
        ...s,
        tracker,
        statuses,
        deniedKeys,
        emails: s.emails.map((x) => (x.id === emailId ? { ...x, undone: true } : x)),
      };
    });
  },
};

// ---------------- pure transitions (exported for tests) ----------------

export function applyPosting(s: AppState, posting: Posting, nowIso: string, by: 'user' | 'email'): AppState {
  const existing = s.tracker[posting.id];
  const card: TrackerCard = existing ?? {
    postingId: posting.id,
    dedupeKey: posting.dedupeKey,
    company: posting.company,
    companySlug: posting.companySlug,
    title: posting.title,
    applyUrl: posting.applyUrl,
    industry: posting.classification.industry,
    career: posting.classification.career,
    stage: 'applied',
    appliedAt: nowIso,
    notes: '',
    movedByEmail: null,
    history: [{ stage: 'applied', at: nowIso, by }],
  };
  return {
    ...s,
    statuses: { ...s.statuses, [posting.id]: { status: 'applied', at: nowIso } },
    tracker: { ...s.tracker, [posting.id]: card },
  };
}

export function moveTrackerCard(
  s: AppState,
  postingId: string,
  stage: TrackerStage,
  nowIso: string,
  by: 'user' | 'email',
  emailId?: string,
): AppState {
  const card = s.tracker[postingId];
  if (!card || card.stage === stage) return s;
  const moved: TrackerCard = {
    ...card,
    stage,
    movedByEmail: by === 'email' ? { from: card.stage, at: nowIso, emailId: emailId ?? '' } : null,
    history: [...card.history, { stage, at: nowIso, by }],
  };
  let deniedKeys = s.deniedKeys.filter((k) => k !== card.dedupeKey);
  if (stage === 'denied') deniedKeys = [...deniedKeys, card.dedupeKey];
  return { ...s, tracker: { ...s.tracker, [postingId]: moved }, deniedKeys };
}

export type { InboundEmail };
