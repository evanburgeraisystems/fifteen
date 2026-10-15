import { useMemo } from 'react';
import { Link, NavLink, useParams } from 'react-router';
import { companyPay, fmtHourly, FULL_TIME_PAY_NOTE } from '../../core/pay.ts';
import { labelCareer, labelIndustry } from '../../core/taxonomy.ts';
import type { CareerId, HistoryRole } from '../../core/types.ts';
import { companyRolesByCycle, fmtMonthDay, fmtMonthYear, predictCompanyWindow, previousCycle } from '../../core/windows.ts';
import { Icon } from '../components/Icon.tsx';
import { JobCard, StarButton } from '../components/JobCard.tsx';
import { plural } from '../format.ts';
import { useApp } from '../state/app-context.tsx';

export function Company({ tab }: { tab: 'roles' | 'pay' | 'cycle' }) {
  const { slug = '' } = useParams();
  const { ds, ranked, companyBySlug } = useApp();
  const info = companyBySlug.get(slug);
  const now = ds.nowIso();
  const window = useMemo(() => predictCompanyWindow(slug, ds.visible, ds.history, now), [slug, ds, now]);
  const roles = useMemo(() => ranked.filter((r) => r.posting.companySlug === slug), [ranked, slug]);
  const lastCycle = useMemo(() => companyRolesByCycle(ds.history, slug, previousCycle(now)), [ds, slug, now]);

  if (!info) {
    return (
      <div className="page">
        <div className="state">
          <span className="state-icon">
            <Icon name="search" />
          </span>
          <h1 className="page-title">We don’t track that company yet</h1>
          <p>It isn’t in the listings or history. Companies are added to the daily pull from a seed list.</p>
          <Link to="/stars" className="btn btn-secondary">
            Back to Stars
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div className="head-row">
          <div>
            <p className="crumb">
              <Link to="/stars">Stars</Link> <Icon name="chevron-right" size={12} /> {labelIndustry(info.industry)}
            </p>
            <h1 className="page-title">{info.name}</h1>
            <p className="page-sub" title={window.basis}>
              <span className={`window ${window.status === 'open' ? 'is-open' : window.status === 'opening' ? 'is-opening' : ''}`}>{window.label}</span>
              <span className="muted"> · {window.basis}</span>
            </p>
          </div>
          <StarButton slug={info.slug} name={info.name} size="md" />
        </div>
        <nav className="subnav" aria-label={`${info.name} sections`}>
          <NavLink to={`/company/${slug}`} end>
            Top Role Fits
          </NavLink>
          <NavLink to={`/company/${slug}/pay`}>~Pay at Each Level</NavLink>
          <NavLink to={`/company/${slug}/cycle`}>Last Intern Cycle</NavLink>
        </nav>
      </header>

      {tab === 'roles' ? (
        roles.length ? (
          <ul className="job-grid">
            {roles.map((r) => (
              <li key={r.posting.id}>
                <JobCard item={r} showFit />
              </li>
            ))}
          </ul>
        ) : (
          <div className="state">
            <h2>Nothing posted right now</h2>
            <p>{window.lastCycle ? `Opened ~${fmtMonthDay(window.lastCycle.opened)} last year. ` : ''}Star it and we’ll light it up when roles appear.</p>
          </div>
        )
      ) : null}

      {tab === 'pay' ? <PayView slug={slug} lastCycle={lastCycle} /> : null}
      {tab === 'cycle' ? <CycleView roles={lastCycle} cycleLabel={previousCycle(now).replace('summer-', 'Summer ')} /> : null}
    </div>
  );
}

function PayView({ slug, lastCycle }: { slug: string; lastCycle: ReturnType<typeof companyRolesByCycle> }) {
  const { ds } = useApp();
  const levels = useMemo(() => companyPay(slug, ds.visible, lastCycle), [slug, ds, lastCycle]);
  return (
    <section aria-labelledby="pay-h" className="pay">
      <h2 id="pay-h" className="section-title">
        Intern pay
      </h2>
      {levels.length === 0 ? (
        <p className="muted">No pay listed in this company’s postings yet.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Role type</th>
              <th scope="col">Typical</th>
              <th scope="col">Range</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((l) => (
              <tr key={l.career}>
                <th scope="row">{l.label}</th>
                <td className="num">{fmtHourly(l.hourly)}</td>
                <td>
                  {l.samples > 1 ? `${fmtHourly(l.low)} to ${fmtHourly(l.high).slice(1)}` : '·'}
                </td>
                <td className="muted">
                  {plural(l.samples, 'posting')}, {l.when} ({l.sources.map((s) => (s === 'field' ? 'pay field' : 'pay-transparency text')).join(' + ')})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="field-hint">Approximate. Converted to hourly from the posting’s own numbers (40-hour weeks).</p>
      <h2 className="section-title pay-ft">Full-time levels</h2>
      <p className="muted">{FULL_TIME_PAY_NOTE}</p>
    </section>
  );
}

const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

function CycleView({ roles, cycleLabel }: { roles: ReturnType<typeof companyRolesByCycle>; cycleLabel: string }) {
  const { ds } = useApp();
  const groups = useMemo(() => {
    const by = new Map<CareerId, HistoryRole[]>();
    for (const r of roles) by.set(r.career, [...(by.get(r.career) ?? []), r]);
    return [...by.entries()]
      .map(([career, rs]) => {
        const sorted = [...rs].sort((a, b) => (a.opened < b.opened ? -1 : 1));
        const opened = sorted[0]?.opened ?? '';
        const closes = rs.map((r) => r.closed);
        const closed = closes.some((c) => c == null) ? null : (closes.sort().at(-1) ?? null);
        return { career, roles: sorted, opened, closed };
      })
      .sort((a, b) => (a.opened < b.opened ? -1 : 1));
  }, [roles]);

  if (roles.length === 0) {
    return (
      <div className="state">
        <h2>No history for last cycle</h2>
        <p>
          {ds.history ? `We’ve been tracking since ${fmtMonthYear(ds.history.trackingSince)}.` : ''} Every day we pull becomes next year’s timeline, so this fills in
          as the season runs.
        </p>
      </div>
    );
  }
  const first = groups[0];
  const year = first ? Number(first.opened.slice(0, 4)) - (Number(first.opened.slice(5, 7)) < 7 ? 1 : 0) : 2025;
  const start = Date.UTC(year, 6, 1);
  const span = Date.UTC(year + 1, 6, 1) - start;
  const pos = (iso: string) => Math.max(0, Math.min(100, ((Date.parse(iso) - start) / span) * 100));
  const bar = (opened: string, closed: string | null) => {
    const left = pos(opened);
    const right = closed ? pos(closed) : 100;
    return { left: `${left}%`, width: `${Math.max(1.5, right - left)}%` };
  };

  return (
    <section aria-labelledby="cycle-h">
      <h2 id="cycle-h" className="section-title">
        {cycleLabel} cycle: when each kind of role opened and closed
      </h2>
      <p className="field-hint">
        From our daily pulls{ds.isDemo ? ' (demo history)' : ''}. Each bar runs from the first day a role of that kind was live to the last. Open a row to
        see every role.
      </p>
      <div className="timeline">
        <div className="tl-months" aria-hidden="true">
          <span />
          <div className="tl-scale">
            {MONTHS.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>
        {groups.map((g) => (
          <details key={g.career} className="tl-group">
            <summary className="tl-row">
              <span className="tl-label">
                {labelCareer(g.career)}
                <span className="muted"> · {plural(g.roles.length, 'role')}</span>
              </span>
              <span className="tl-track" aria-label={`Opened ${fmtMonthDay(g.opened)}${g.closed ? `, closed ${fmtMonthDay(g.closed)}` : ', still open'}`}>
                <span className="tl-bar" style={bar(g.opened, g.closed)} />
                <span className="tl-dates">
                  {fmtMonthDay(g.opened)} – {g.closed ? fmtMonthDay(g.closed) : 'open'}
                </span>
              </span>
            </summary>
            <ul className="tl-roles">
              {g.roles.map((r) => (
                <li key={r.dedupeKey} className="tl-row">
                  <span className="tl-label tl-sub">{r.title}</span>
                  <span className="tl-track" aria-label={`Opened ${fmtMonthDay(r.opened)}${r.closed ? `, closed ${fmtMonthDay(r.closed)}` : ', still open'}`}>
                    <span className="tl-bar tl-bar-sub" style={bar(r.opened, r.closed)} />
                    <span className="tl-dates">
                      {fmtMonthDay(r.opened)} – {r.closed ? fmtMonthDay(r.closed) : 'open'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
