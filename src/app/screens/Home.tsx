import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { TIER_LABEL, TIER_LEGEND, TIER_ORDER, type Ranked } from '../../core/fit.ts';
import { BUSINESS_CAREERS, CITIES, INDUSTRIES } from '../../core/taxonomy.ts';
import type { CareerId, CityId, FitTier, IndustryId } from '../../core/types.ts';
import { seasonFor, zeroDaySentence } from '../../core/windows.ts';
import { FilterMenu } from '../components/FilterMenu.tsx';
import { JobCard } from '../components/JobCard.tsx';
import { NewStars } from '../components/NewStars.tsx';
import { SeasonStrip } from '../components/SeasonStrip.tsx';
import { weekdayLong } from '../format.ts';
import { useCountUp } from '../hooks.ts';
import { useApp } from '../state/app-context.tsx';
import { actions } from '../state/store.ts';

export interface Filters {
  industries: IndustryId[];
  careers: CareerId[];
  cities: CityId[];
}

export function applyFilters(items: Ranked[], f: Filters): Ranked[] {
  return items.filter(
    ({ posting: p }) =>
      (f.industries.length === 0 || f.industries.includes(p.classification.industry)) &&
      (f.careers.length === 0 || f.careers.includes(p.classification.career)) &&
      (f.cities.length === 0 || p.cities.some((c) => f.cities.includes(c))),
  );
}

const PAGE = 8;

export function Home() {
  const { ds, ranked, targets, state, isNew } = useApp();
  const [filters, setFilters] = useState<Filters>(() => ({
    industries: targets?.industries ?? [],
    careers: targets?.careers ?? [],
    cities: targets?.cities ?? [],
  }));
  const [populating] = useState(() => state.populatePending);

  const inView = useMemo(() => applyFilters(ranked, filters), [ranked, filters]);

  const lanes = useMemo(() => {
    const by: Record<FitTier, Ranked[]> = { perfect: [], almost: [], weak: [], nonfit: [] };
    for (const r of inView) by[r.fit.tier].push(r);
    // Newest pull first inside each lane, then fit order (already sorted).
    for (const t of TIER_ORDER) {
      by[t] = [...by[t].filter((r) => r.posting.firstSeen === ds.pullDate), ...by[t].filter((r) => r.posting.firstSeen !== ds.pullDate)];
    }
    return by;
  }, [inView, ds.pullDate]);

  const newCounts = useMemo(() => {
    const c: Record<FitTier, number> = { perfect: 0, almost: 0, weak: 0, nonfit: 0 };
    for (const r of inView) if (r.posting.firstSeen === ds.pullDate) c[r.fit.tier]++;
    return c;
  }, [inView, ds.pullDate]);
  const newTotal = newCounts.perfect + newCounts.almost + newCounts.weak;

  // New badges clear once seen: record what this visit showed.
  useEffect(() => {
    const ids = inView.filter((r) => isNew(r.posting)).map((r) => r.posting.id);
    if (ids.length) actions.markSeen(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- record once per filter change, not on every status change
  }, [inView]);

  useEffect(() => {
    if (!populating) return;
    const t = window.setTimeout(() => actions.consumePopulate(), 1200);
    return () => window.clearTimeout(t);
  }, [populating]);

  const seasonIndustries = useMemo(
    () => (filters.industries.length ? filters.industries : (targets?.industries ?? [])),
    [filters.industries, targets],
  );
  const zeroSentence = useMemo(() => {
    if (newTotal > 0) return null;
    const seasons = seasonIndustries.map((i) => seasonFor(i, ds.history, ds.visible, ds.nowIso()));
    return zeroDaySentence(seasons);
  }, [newTotal, seasonIndustries, ds]);

  const isToday = ds.pullDate === new Date().toISOString().slice(0, 10) || ds.isDemo;

  return (
    <div className={`page ${populating ? 'populate' : ''}`}>
      <header className="page-head">
        <div className="toolbar">
          <FilterMenu label="Industry" options={INDUSTRIES} value={filters.industries} onChange={(v) => setFilters({ ...filters, industries: v })} />
          <FilterMenu label="Career" options={BUSINESS_CAREERS} value={filters.careers} onChange={(v) => setFilters({ ...filters, careers: v })} />
          <FilterMenu label="City" options={CITIES} value={filters.cities} onChange={(v) => setFilters({ ...filters, cities: v })} />
          <SeasonStrip industries={seasonIndustries} />
        </div>

        <h1 className="sr-only">Home</h1>
        <div className="today" aria-live="polite">
          <span className="today-label">
            {isToday ? 'New today' : `New on the ${weekdayLong(ds.pullDate)} pull`}
            {populating ? (
              <>
                {' · '}
                <span className="serif-accent gradient-text">your</span> fifteen minutes start here
              </>
            ) : null}
          </span>
          {zeroSentence ? (
            <p className="today-zero" data-testid="zero-day">
              {zeroSentence}
            </p>
          ) : (
            <>
              <TodayStat n={newCounts.perfect} label="Perfect" gradient animate={populating} />
              <TodayStat n={newCounts.almost} label="Almost" animate={populating} />
              <TodayStat n={newCounts.weak} label="Weak" animate={populating} />
            </>
          )}
        </div>
        <p className="legend" data-testid="tier-legend">
          {TIER_ORDER.map((t) => (
            <span key={t}>
              <b>{TIER_LABEL[t]}</b> {TIER_LEGEND[t]}
            </span>
          ))}
        </p>
      </header>

      <div className="home-grid">
        <div className="lanes" role="region" aria-label="Roles by fit">
          {TIER_ORDER.map((t) => (
            <Lane key={t} tier={t} items={lanes[t]} />
          ))}
        </div>
        <NewStars />
      </div>
    </div>
  );
}

function TodayStat({ n, label, gradient, animate }: { n: number; label: string; gradient?: boolean; animate: boolean }) {
  const shown = useCountUp(n, animate);
  return (
    <span className="today-stat" data-testid={`new-${label.toLowerCase()}`}>
      <span className={`num ${gradient && n > 0 ? 'gradient-text' : ''}`}>{shown}</span>
      {label}
    </span>
  );
}

function Lane({ tier, items }: { tier: FitTier; items: Ranked[] }) {
  const [limit, setLimit] = useState(PAGE);
  const shown = items.slice(0, limit);
  const rest = items.length - shown.length;
  const headId = `lane-${tier}`;
  return (
    <section className={`lane lane-${tier}`} aria-labelledby={headId} data-testid={`lane-${tier}`}>
      <div className="lane-head">
        <h2 id={headId} className="lane-name">
          {TIER_LABEL[tier]}
        </h2>
        <span className="num lane-count" aria-label={`${items.length} roles`}>
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="lane-empty">{emptyCopy(tier)}</p>
      ) : (
        <ul className="lane-list">
          {shown.map((r, i) => (
            <li key={r.posting.id} style={{ ['--i' as string]: Math.min(i, 8) }}>
              <JobCard item={r} />
            </li>
          ))}
        </ul>
      )}
      {rest > 0 ? (
        <button type="button" className="link-btn lane-more" onClick={() => setLimit((l) => l + 20)}>
          Show {Math.min(rest, 20)} more of {rest}
        </button>
      ) : null}
      {tier === 'perfect' && items.length === 0 ? (
        <p className="lane-empty">
          <Link to="/settings#targets">Widen your targets</Link> or <Link to="/jobs">see every listing</Link>.
        </p>
      ) : null}
    </section>
  );
}

function emptyCopy(tier: FitTier): string {
  switch (tier) {
    case 'perfect':
      return 'Nothing Perfect in these filters yet.';
    case 'almost':
      return 'No Almost roles here.';
    case 'weak':
      return 'No Weak roles here.';
    default:
      return 'Nothing here.';
  }
}
