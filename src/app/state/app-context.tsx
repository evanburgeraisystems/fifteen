import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { profileSignals, rankPostings, type ProfileSignals, type Ranked } from '../../core/fit.ts';
import type { IndustryId, JobStatus, Posting, Targets } from '../../core/types.ts';
import type { Dataset } from '../data/dataset.ts';
import { useAppState, type AppState } from './store.ts';

export interface CompanyInfo {
  slug: string;
  name: string;
  industry: IndustryId;
  live: number;
}

export interface AppCtx {
  ds: Dataset;
  state: AppState;
  targets: Targets | null;
  me: ProfileSignals | null;
  /** Every visible posting, minus denied roles, ranked by fit. */
  ranked: Ranked[];
  rankedById: Map<string, Ranked>;
  companies: CompanyInfo[];
  companyBySlug: Map<string, CompanyInfo>;
  isNew: (p: Posting) => boolean;
  statusOf: (p: Posting) => JobStatus;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

export function AppProvider({ ds, children }: { ds: Dataset; children: ReactNode }) {
  const state = useAppState();
  const { targets, profile, deniedKeys, statuses, seen, visit } = state;

  const me = useMemo(() => (targets ? profileSignals(profile, targets, ds.nowIso()) : null), [targets, profile, ds]);

  const ranked = useMemo(() => {
    if (!targets || !me) return [];
    const denied = new Set(deniedKeys);
    const pool = denied.size ? ds.visible.filter((p) => !denied.has(p.dedupeKey)) : ds.visible;
    return rankPostings(pool, me, targets, ds.nowIso());
  }, [ds, me, targets, deniedKeys]);

  const rankedById = useMemo(() => new Map(ranked.map((r) => [r.posting.id, r])), [ranked]);

  const companies = useMemo(() => {
    const m = new Map<string, CompanyInfo>();
    for (const p of ds.visible) {
      const c = m.get(p.companySlug);
      if (c) c.live++;
      else m.set(p.companySlug, { slug: p.companySlug, name: p.company, industry: p.classification.industry, live: 1 });
    }
    for (const r of ds.history?.roles ?? []) {
      if (!m.has(r.companySlug)) m.set(r.companySlug, { slug: r.companySlug, name: r.company, industry: r.industry, live: 0 });
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [ds]);

  const companyBySlug = useMemo(() => new Map(companies.map((c) => [c.slug, c])), [companies]);

  const value = useMemo<AppCtx>(() => {
    const isNew = (p: Posting) => {
      if (!ds.isFresh(p)) return false;
      if (statuses[p.id]) return false;
      const s = seen[p.id];
      // A New badge stays for the visit it was first seen in, then clears.
      return s == null || s === visit;
    };
    const statusOf = (p: Posting): JobStatus => statuses[p.id]?.status ?? 'new';
    return { ds, state, targets, me, ranked, rankedById, companies, companyBySlug, isNew, statusOf };
  }, [ds, state, targets, me, ranked, rankedById, companies, companyBySlug, statuses, seen, visit]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
