import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { TIER_LABEL, TIER_LEGEND, TIER_ORDER } from '../../core/fit.ts';
import { BUSINESS_CAREERS, CITIES, INDUSTRIES, labelCareer } from '../../core/taxonomy.ts';
import type { CareerId } from '../../core/types.ts';
import { daysBetween } from '../../core/windows.ts';
import { FilterMenu } from '../components/FilterMenu.tsx';
import { Icon } from '../components/Icon.tsx';
import { JobCard } from '../components/JobCard.tsx';
import { plural } from '../format.ts';
import { useApp } from '../state/app-context.tsx';
import { actions } from '../state/store.ts';
import { applyFilters, type Filters } from './Home.tsx';

type Posted = 'any' | '1' | '7' | '30';
const POSTED: { id: Posted; label: string }[] = [
  { id: 'any', label: 'Any time' },
  { id: '1', label: 'Today' },
  { id: '7', label: 'Past week' },
  { id: '30', label: 'Past month' },
];

const PAGE = 50;

/** If the student keeps applying to one career outside their targets, offer to add it (once). */
export function outsideTargetSuggestion(
  cards: { career: CareerId }[],
  targetCareers: CareerId[],
  dismissed: string[],
  threshold = 3,
): { career: CareerId; count: number } | null {
  const counts = new Map<CareerId, number>();
  for (const c of cards) if (!targetCareers.includes(c.career)) counts.set(c.career, (counts.get(c.career) ?? 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < threshold || dismissed.includes(`career:${best[0]}`)) return null;
  return { career: best[0], count: best[1] };
}

export function Jobs() {
  const { ds, ranked, state, targets } = useApp();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>({ industries: [], careers: [], cities: [] });
  const [posted, setPosted] = useState<Posted>('any');
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.get('focus') === 'search') search.current?.focus();
  }, [params]);

  const results = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const today = ds.nowIso();
    return applyFilters(ranked, filters).filter(({ posting: p }) => {
      if (posted !== 'any' && daysBetween(p.firstSeen, today) >= Number(posted)) return false;
      if (!terms.length) return true;
      const hay = `${p.company} ${p.title} ${p.locations.join(' ')} ${p.department ?? ''}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [ranked, filters, posted, q, ds]);

  // Paging resets whenever the query changes.
  const queryKey = JSON.stringify([filters, posted, q]);
  const [page, setPage] = useState({ key: queryKey, limit: PAGE });
  const limit = page.key === queryKey ? page.limit : PAGE;
  const setLimit = (fn: (l: number) => number) => setPage({ key: queryKey, limit: fn(limit) });

  const suggestion = targets ? outsideTargetSuggestion(Object.values(state.tracker), targets.careers, state.dismissedSuggestions) : null;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Every Job Listing</h1>
        <p className="page-sub">
          {plural(ds.visible.length, 'business internship')} with links verified on the latest pull, sorted by fit to your resume.
        </p>
        <div className="toolbar jobs-toolbar">
          <div className="search">
            <Icon name="search" size={16} />
            <label htmlFor="job-search" className="sr-only">
              Search roles
            </label>
            <input
              id="job-search"
              ref={search}
              className="input"
              type="search"
              placeholder="Search company, role or city"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <FilterMenu label="Industry" options={INDUSTRIES} value={filters.industries} onChange={(v) => setFilters({ ...filters, industries: v })} />
          <FilterMenu label="Career" options={BUSINESS_CAREERS} value={filters.careers} onChange={(v) => setFilters({ ...filters, careers: v })} />
          <FilterMenu label="City" options={CITIES} value={filters.cities} onChange={(v) => setFilters({ ...filters, cities: v })} />
          <label className="sr-only" htmlFor="posted">
            Posted
          </label>
          <select id="posted" className="filter-btn select" value={posted} onChange={(e) => setPosted(e.target.value as Posted)}>
            {POSTED.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <p className="legend">
          {TIER_ORDER.map((t) => (
            <span key={t}>
              <b>{TIER_LABEL[t]}</b> {TIER_LEGEND[t]}
            </span>
          ))}
        </p>
      </header>

      {suggestion ? (
        <div className="notice" data-testid="add-target-suggestion">
          <p>
            You’ve applied to {suggestion.count} {labelCareer(suggestion.career)} roles. Add {labelCareer(suggestion.career)} to your targets?
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              if (targets) actions.setTargets({ ...targets, careers: [...targets.careers, suggestion.career] });
              actions.dismissSuggestion(`career:${suggestion.career}`);
            }}
          >
            Add to targets
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.dismissSuggestion(`career:${suggestion.career}`)}>
            No thanks
          </button>
        </div>
      ) : null}

      <p className="result-count" aria-live="polite">
        {results.length === ranked.length ? `Showing all ${plural(results.length, 'role')}` : `${plural(results.length, 'role')} match`}
      </p>

      {results.length === 0 ? (
        <div className="state">
          <span className="state-icon">
            <Icon name="search" />
          </span>
          <h2>No roles match</h2>
          <p>Try fewer words or clear a filter. Every listing here has a verified direct link.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setQ('');
              setFilters({ industries: [], careers: [], cities: [] });
              setPosted('any');
            }}
          >
            Clear search and filters
          </button>
        </div>
      ) : (
        <ul className="job-grid">
          {results.slice(0, limit).map((r) => (
            <li key={r.posting.id}>
              <JobCard item={r} showFit />
            </li>
          ))}
        </ul>
      )}
      {results.length > limit ? (
        <div className="more-row">
          <button type="button" className="btn btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>
            Show {Math.min(PAGE, results.length - limit)} more
          </button>
          <span className="muted">
            {limit} of {results.length}
          </span>
        </div>
      ) : null}
    </div>
  );
}
