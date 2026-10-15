import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { TIER_LABEL } from '../../core/fit.ts';
import { labelIndustry } from '../../core/taxonomy.ts';
import { fmtMonthDay } from '../../core/windows.ts';
import { Icon } from '../components/Icon.tsx';
import { useApp } from '../state/app-context.tsx';
import { actions } from '../state/store.ts';
import { useStarViews, type StarView } from '../state/use-stars.ts';

export function Stars() {
  const { companies, state, ds } = useApp();
  const views = useStarViews();
  const [q, setQ] = useState('');
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return companies.filter((c) => c.name.toLowerCase().includes(t)).slice(0, 8);
  }, [q, companies]);

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title">Stars</h1>
        <p className="page-sub">Companies you’re watching. Each card tells you whether its window is open, when it should open, and what it paid.</p>
        <div className="star-search">
          <div className="search">
            <Icon name="search" size={16} />
            <label htmlFor="company-search" className="sr-only">
              Find a company to star
            </label>
            <input
              id="company-search"
              className="input"
              type="search"
              placeholder="Find a company to star"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
          </div>
          {q.trim() ? (
            <ul className="search-results" aria-label="Companies">
              {matches.length === 0 ? <li className="field-hint">No company by that name in the listings yet.</li> : null}
              {matches.map((c) => {
                const on = !!state.stars[c.slug];
                return (
                  <li key={c.slug}>
                    <span>
                      <strong>{c.name}</strong> <span className="muted">· {labelIndustry(c.industry)} · {c.live} open</span>
                    </span>
                    <button
                      type="button"
                      className={on ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'}
                      aria-pressed={on}
                      onClick={() => actions.toggleStar(c.slug, c.name, ds.nowIso())}
                    >
                      <Icon name={on ? 'star-filled' : 'star'} size={14} /> {on ? 'Starred' : 'Star'}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </header>

      {views.length === 0 ? (
        <div className="state">
          <span className="state-icon gold">
            <Icon name="star" />
          </span>
          <h2>No stars yet</h2>
          <p>Star a company from any card or the search above. You’ll see when it posts, when its window should open, and deadlines on roles you haven’t applied to.</p>
        </div>
      ) : (
        <ul className="galaxy">
          {views.map((v) => (
            <li key={v.slug}>
              <StarCard view={v} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StarCard({ view }: { view: StarView }) {
  const { ds, ranked } = useApp();
  const [showRoles, setShowRoles] = useState(false);
  const roles = useMemo(() => ranked.filter((r) => r.posting.companySlug === view.slug).slice(0, 5), [ranked, view.slug]);
  const glowing = view.fresh.length > 0;
  const statusClass = view.window.status === 'open' ? 'is-open' : view.window.status === 'opening' ? 'is-opening' : '';

  return (
    <article
      className={`star-card ${glowing ? 'is-glowing' : ''}`}
      data-testid={`starcard-${view.slug}`}
      data-glowing={glowing}
      onClick={() => {
        if (glowing) actions.ackStar(view.slug, ds.nowIso());
      }}
    >
      <div className="star-card-head">
        <h2 className="star-card-name">
          <Link to={`/company/${view.slug}`}>{view.name}</Link>
        </h2>
        <button
          type="button"
          className="icon-btn star-btn is-on"
          aria-label={`Unstar ${view.name}`}
          title="Unstar"
          onClick={(e) => {
            e.stopPropagation();
            actions.toggleStar(view.slug, view.name, ds.nowIso());
          }}
        >
          <Icon name="star-filled" size={17} />
        </button>
      </div>
      <p className={`window ${statusClass}`} title={view.window.basis}>
        {view.window.label}
        {view.window.status === 'open' ? <span className="muted"> · {view.window.openCount} roles</span> : null}
      </p>
      {glowing ? (
        <ul className="star-news">
          {view.fresh.map((e) => (
            <li key={`${e.kind}-${e.text}`}>{e.text}</li>
          ))}
        </ul>
      ) : null}

      <div className="star-links">
        <button type="button" className="link-btn underline" aria-expanded={showRoles} onClick={() => setShowRoles((s) => !s)}>
          Top Role Fits
        </button>
        {showRoles ? (
          roles.length ? (
            <ol className="role-fits">
              {roles.map((r) => (
                <li key={r.posting.id}>
                  <span className={`fit-dot fit-${r.fit.tier}`} aria-hidden="true" />
                  <a
                    href={r.posting.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.markOpened(r.posting.id, ds.nowIso());
                    }}
                  >
                    {r.posting.title}
                  </a>
                  <span className="muted">{TIER_LABEL[r.fit.tier]}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="field-hint">
              Nothing posted.{' '}
              {view.window.lastCycle ? `Opened ~${fmtMonthDay(view.window.lastCycle.opened)} last year.` : view.window.basis}
            </p>
          )
        ) : null}
        <Link className="underline" to={`/company/${view.slug}/pay`}>
          ~Pay at Each Level
        </Link>
        <Link className="underline" to={`/company/${view.slug}/cycle`}>
          Last Intern Cycle
        </Link>
      </div>

      <label className="alert-toggle" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          role="switch"
          className="switch"
          aria-checked={view.alerts}
          aria-label={`Alerts for ${view.name}`}
          onClick={() => actions.setStarAlerts(view.slug, !view.alerts)}
        />
        <span className="field-hint">Alerts</span>
      </label>
    </article>
  );
}
