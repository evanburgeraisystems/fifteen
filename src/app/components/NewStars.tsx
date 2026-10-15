import { useState } from 'react';
import { Link } from 'react-router';
import { useApp } from '../state/app-context.tsx';
import { actions } from '../state/store.ts';
import { useStarViews, type StarView } from '../state/use-stars.ts';
import { Icon } from './Icon.tsx';

/**
 * The ¼ column on Home. Resting stars are a plain list with a gold star.
 * A company with news gets the gold surface and the breathing halo until its card is clicked.
 */
export function NewStars() {
  const views = useStarViews();
  const glowing = views.filter((v) => v.fresh.length > 0).length;
  return (
    <section className="home-stars" aria-labelledby="new-stars-h">
      <div className="stars-col-head">
        <h2 id="new-stars-h" className="lane-name">
          New Stars
        </h2>
        <span className="star-line">{glowing ? `${glowing} with news` : views.length ? 'All caught up' : ''}</span>
      </div>
      {views.length === 0 ? (
        <div className="lane-empty">
          <p>Star companies to see when they post, open or close.</p>
          <p style={{ marginTop: 'var(--s-2)' }}>
            <Link to="/stars">Find companies</Link>
          </p>
        </div>
      ) : (
        <ul className="star-list">
          {views.map((v) => (
            <li key={v.slug}>
              <StarItem view={v} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StarItem({ view }: { view: StarView }) {
  const { ds } = useApp();
  // What was new stays visible after the click acknowledges it, until the next visit.
  const [revealed, setRevealed] = useState<string[] | null>(null);
  const glowing = view.fresh.length > 0;
  const lines = revealed;

  return (
    <div>
      <button
        type="button"
        className={`star-item ${glowing ? 'is-glowing' : ''}`}
        data-testid={`star-${view.slug}`}
        data-glowing={glowing}
        aria-label={glowing ? `${view.name}: ${view.fresh.length} new. Mark seen` : `${view.name}: ${view.window.label}`}
        onClick={() => {
          if (glowing) {
            setRevealed(view.fresh.map((e) => e.text));
            actions.ackStar(view.slug, ds.nowIso());
          } else {
            setRevealed((r) => (r ? null : view.events.map((e) => e.text)));
          }
        }}
      >
        <span className="star-name">
          <Icon name="star-filled" size={15} />
          {view.name}
        </span>
        <span className="star-line">
          {glowing ? summarize(view.fresh) : view.window.label}
        </span>
      </button>
      {lines && lines.length ? (
        <ul className="why" style={{ listStyle: 'none', paddingLeft: 'var(--s-3)' }}>
          {lines.map((t) => (
            <li key={t}>{t}</li>
          ))}
          <li>
            <Link to={`/company/${view.slug}`}>See {view.name}</Link>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

/** "3 new roles · 2 deadlines soon · window opens ~Oct 19" */
export function summarize(events: StarView['fresh']): string {
  if (events.length === 1) return events[0]?.text ?? '';
  const roles = events.filter((e) => e.kind === 'new-role').length;
  const deadlines = events.filter((e) => e.kind === 'deadline').length;
  const win = events.find((e) => e.kind === 'window-soon');
  const parts: string[] = [];
  if (roles) parts.push(`${roles} new role${roles === 1 ? '' : 's'}`);
  if (deadlines) parts.push(`${deadlines} deadline${deadlines === 1 ? '' : 's'} soon`);
  if (win) parts.push(win.text.replace('Window likely opens', 'opens'));
  return parts.join(' · ');
}
