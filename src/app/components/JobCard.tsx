import { useId, useState } from 'react';
import { TIER_LABEL, type Ranked } from '../../core/fit.ts';
import { fmtComp } from '../../core/pay.ts';
import { signalLabel } from '../../core/signals.ts';
import { labelCity } from '../../core/taxonomy.ts';
import type { FitTier, JobStatus } from '../../core/types.ts';
import { ago, verifiedLabel } from '../format.ts';
import { useApp } from '../state/app-context.tsx';
import { actions } from '../state/store.ts';
import { Icon } from './Icon.tsx';

export function FitBadge({ tier }: { tier: FitTier }) {
  return (
    <span className={`fit-badge fit-${tier}`}>
      <span className="fit-dot" aria-hidden="true" />
      {TIER_LABEL[tier]}
    </span>
  );
}

export function StatusPill({ status, isNew }: { status: JobStatus; isNew: boolean }) {
  if (status === 'applied')
    return (
      <span className="status-applied">
        <Icon name="check" size={13} /> Applied
      </span>
    );
  if (status === 'opened') return <span className="status-opened">Opened</span>;
  if (isNew) return <span className="status-new">New</span>;
  return null;
}

export function StarButton({ slug, name, size = 'sm' }: { slug: string; name: string; size?: 'sm' | 'md' }) {
  const { state, ds } = useApp();
  const on = !!state.stars[slug];
  return (
    <button
      type="button"
      className={`icon-btn star-btn ${on ? 'is-on' : ''} ${size === 'md' ? 'icon-btn-md' : ''}`}
      aria-pressed={on}
      aria-label={on ? `Unstar ${name}` : `Star ${name}`}
      title={on ? `Unstar ${name}` : `Star ${name}`}
      onClick={(e) => {
        e.stopPropagation();
        actions.toggleStar(slug, name, ds.nowIso());
      }}
    >
      <Icon name={on ? 'star-filled' : 'star'} size={size === 'md' ? 20 : 16} />
    </button>
  );
}

function placeOf(cities: string[], locations: string[]): string {
  if (!cities.length) return locations[0] ?? 'US';
  const head = cities.slice(0, 2).join(' · ');
  return cities.length > 2 ? `${head} +${cities.length - 2}` : head;
}

/**
 * One role. Company, title, then a single quiet meta line.
 * The fit label shows only where no lane already says the tier.
 */
export function JobCard({ item, showFit = false }: { item: Ranked; showFit?: boolean }) {
  const { posting: p, fit } = item;
  const { ds, isNew, statusOf } = useApp();
  const [open, setOpen] = useState(false);
  const whyId = useId();
  const now = ds.nowIso();
  const status = statusOf(p);
  const fresh = isNew(p);
  const place = placeOf(
    p.cities.filter((c) => c !== 'other').map(labelCity),
    p.locations,
  );
  const compTitle = p.compensation ? `From the posting: ${p.compensation.raw || 'compensation field'}` : undefined;

  return (
    <article className="job" aria-label={`${p.title} at ${p.company}`} data-posting-id={p.id} data-tier={fit.tier}>
      <div className="job-top">
        <span className="job-company">{p.company}</span>
        <StatusPill status={status} isNew={fresh} />
        <button
          type="button"
          className={`icon-btn why-icon ${open ? 'is-on' : ''}`}
          aria-expanded={open}
          aria-controls={whyId}
          aria-label={`Why ${TIER_LABEL[fit.tier]}: ${p.title}`}
          title={`Why ${TIER_LABEL[fit.tier]}`}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="info" size={15} />
        </button>
        <StarButton slug={p.companySlug} name={p.company} />
      </div>
      <h3 className="job-title">
        <a
          href={p.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => actions.markOpened(p.id, now)}
          aria-label={`${p.title} at ${p.company}. Opens ${p.company}'s posting in a new tab`}
        >
          {p.title}
        </a>
      </h3>
      <div className="job-meta">
        {showFit ? <FitBadge tier={fit.tier} /> : null}
        {!fit.eligible ? <span className="tag-ineligible">Not eligible yet</span> : null}
        <span>{place}</span>
        <span className="sep" aria-hidden="true">
          ·
        </span>
        <span>{ago(p.postedAt ?? p.firstSeen, now)}</span>
        {p.compensation ? (
          <>
            <span className="sep" aria-hidden="true">
              ·
            </span>
            <span title={compTitle}>{fmtComp(p.compensation)}</span>
          </>
        ) : null}
        <span className="verified" title={`Direct link to ${p.company}'s own posting, checked on the latest pull`}>
          <Icon name="check-shield" size={13} />
          {verifiedLabel(p.linkVerifiedAt, now)}
        </span>
      </div>
      {open ? (
        <div className="why" id={whyId}>
          <ul>
            {fit.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {fit.matched.length || fit.missing.length ? (
            <div className="why-signals">
              {fit.matched.map((s) => (
                <span key={s} className="sig sig-hit">
                  <Icon name="check" size={12} />
                  {signalLabel(s)}
                </span>
              ))}
              {fit.missing.map((s) => (
                <span key={s} className="sig sig-miss">
                  {signalLabel(s)}
                </span>
              ))}
            </div>
          ) : null}
          {p.deadline ? (
            <p className="why-note">
              Apply by {new Date(p.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}.
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
