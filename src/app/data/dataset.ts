/**
 * Loads the listings dataset the app runs on.
 *
 *   live      public/data/snapshots/latest.json + public/data/history.json (real pulls)
 *   demo      public/data/demo/*        (fictional, 2,400+ listings, labeled "Demo data")
 *   demo-zero public/data/demo-zero/*   (demo with zero new roles today)
 *
 * Choose with ?dataset=live|demo|demo-zero (remembered for the tab session).
 * Default: live when a live snapshot with business internships exists, else demo.
 */
import { isFreshOnPull } from '../../core/fresh.ts';
import { isUsOrRemote } from '../../core/geo.ts';
import { familyOf } from '../../core/taxonomy.ts';
import type { HistoryFile, Posting, Snapshot } from '../../core/types.ts';

export type DatasetId = 'live' | 'demo' | 'demo-zero';

export interface Dataset {
  id: DatasetId;
  isDemo: boolean;
  snapshot: Snapshot;
  history: HistoryFile | null;
  /** Postings a student can see: US or remote internships, business family, link verified on the latest pull. */
  visible: Posting[];
  /** The date the "new today" badge refers to (the latest pull). */
  pullDate: string;
  /** ISO "now" the app reasons with. Demo data pins the calendar day to the snapshot. */
  nowIso: () => string;
  byId: Map<string, Posting>;
  /** Appeared on the latest pull (first-day aware). */
  isFresh: (p: Posting) => boolean;
}

/** MVP ships business roles; the data and model carry every family. */
export const ENABLED_FAMILIES = new Set(['business']);

const KEY = 'fifteen.dataset';

export function requestedDataset(): DatasetId | null {
  const q = new URLSearchParams(window.location.search).get('dataset');
  if (q === 'live' || q === 'demo' || q === 'demo-zero') {
    try {
      sessionStorage.setItem(KEY, q);
    } catch {
      /* storage unavailable: the URL param still applies for this load */
    }
    return q;
  }
  try {
    const s = sessionStorage.getItem(KEY);
    if (s === 'live' || s === 'demo' || s === 'demo-zero') return s;
  } catch {
    /* ignore */
  }
  return null;
}

export function setDatasetPreference(id: DatasetId): void {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) return null;
  const type = res.headers.get('content-type') ?? '';
  // Vite's dev server answers unknown paths with index.html; treat that as missing.
  if (!type.includes('json')) return null;
  return (await res.json()) as T;
}

const paths: Record<DatasetId, { latest: string; history: string }> = {
  live: { latest: '/data/snapshots/latest.json', history: '/data/history.json' },
  demo: { latest: '/data/demo/latest.json', history: '/data/demo/history.json' },
  'demo-zero': { latest: '/data/demo-zero/latest.json', history: '/data/demo-zero/history.json' },
};

export function isVisible(p: Posting, pullDate: string): boolean {
  return (
    p.isInternship &&
    p.linkStatus === 'ok' &&
    p.linkVerifiedAt != null &&
    p.linkVerifiedAt.slice(0, 10) === pullDate &&
    ENABLED_FAMILIES.has(familyOf(p.classification.career)) &&
    isUsOrRemote(p)
  );
}

export function buildDataset(id: DatasetId, snapshot: Snapshot, history: HistoryFile | null): Dataset {
  const pullDate = snapshot.date;
  const visible = snapshot.postings.filter((p) => isVisible(p, pullDate));
  const isDemo = snapshot.dataset === 'demo';
  const nowIso = isDemo
    ? () => {
        const t = new Date();
        return `${pullDate}T${t.toISOString().slice(11)}`;
      }
    : () => new Date().toISOString();
  const isFresh = (p: Posting) => isFreshOnPull(p, pullDate, snapshot.trackingSince);
  return { id, isDemo, snapshot, history, visible, pullDate, nowIso, byId: new Map(visible.map((p) => [p.id, p])), isFresh };
}

export async function loadDataset(): Promise<Dataset> {
  const want = requestedDataset();
  const order: DatasetId[] = want ? [want] : ['live', 'demo'];
  for (const id of order) {
    const snapshot = await getJson<Snapshot>(paths[id].latest);
    if (!snapshot) continue;
    const history = await getJson<HistoryFile>(paths[id].history);
    const ds = buildDataset(id, snapshot, history);
    if (!want && id === 'live' && ds.visible.length === 0) continue;
    return ds;
  }
  throw new Error('No listings data found. Run `npm run pull` (live) or `npm run demo-data` (demo).');
}
