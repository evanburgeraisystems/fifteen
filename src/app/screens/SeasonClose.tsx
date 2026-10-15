import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { cycleYear } from '../../core/cycle.ts';
import { fmtMonthDay, currentCycle } from '../../core/windows.ts';
import { Icon } from '../components/Icon.tsx';
import { plural } from '../format.ts';
import { useApp } from '../state/app-context.tsx';
import { useStarViews } from '../state/use-stars.ts';

/**
 * Season close, two versions:
 *  - an offer landed: "Congrats!" with a shareable recap card
 *  - no offer: "Keep going." Private, forward-looking: what moved, and when starred companies open next
 */
export function SeasonClose() {
  const { state, ds } = useApp();
  const stars = useStarViews();
  const cards = Object.values(state.tracker);
  const reached = (stage: 'assessment' | 'interview' | 'offer') =>
    cards.filter((c) => c.history.some((h) => h.stage === stage) || c.stage === stage).length;
  const stats = {
    applied: cards.length,
    assessments: reached('assessment'),
    interviews: reached('interview'),
  };
  const offers = cards.filter((c) => c.stage === 'offer');
  const summer = cycleYear(currentCycle(ds.nowIso()));

  const nextOpenings = useMemo(
    () =>
      stars
        .filter((s) => s.window.predictedOpen || s.window.status === 'open')
        .map((s) => ({
          name: s.name,
          slug: s.slug,
          when: s.window.status === 'open' ? 'Open now' : s.window.predictedOpen ? `~${fmtMonthDay(s.window.predictedOpen)}` : '',
          basis: s.window.basis,
        }))
        .slice(0, 6),
    [stars],
  );

  if (offers.length) {
    const offer = offers[0];
    return (
      <div className="page season-page">
        <div className="season-hero celebrate">
          <p className="eyebrow">Summer {summer}</p>
          <h1 className="season-title">Congrats!</h1>
          <p className="season-lead">
            You landed an offer from <span className="gradient-text strong">{offer?.company}</span>
            {offer ? <> for {offer.title}.</> : '.'}
          </p>
          <RecapCard company={offer?.company ?? ''} title={offer?.title ?? ''} summer={summer} stats={stats} />
          <p className="field-hint">Your tracker and stars stay put for next year.</p>
          <Link to="/" className="btn btn-secondary">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page season-page">
      <div className="season-hero">
        <p className="eyebrow">Summer {summer} · just for you</p>
        <h1 className="season-title">Keep going.</h1>
        <p className="season-lead">
          Every application this season made the next one faster. Here’s what moved, and what opens next.
        </p>
        <div className="season-stats" role="list" aria-label="What moved this season">
          <Stat n={stats.applied} label="applications sent" />
          <Stat n={stats.assessments} label="assessments reached" />
          <Stat n={stats.interviews} label="interviews reached" />
        </div>
        <section className="season-next" aria-labelledby="next-h">
          <h2 id="next-h" className="section-title">
            When your stars open next
          </h2>
          {nextOpenings.length ? (
            <ul className="next-list">
              {nextOpenings.map((n) => (
                <li key={n.slug}>
                  <Icon name="star-filled" size={14} />
                  <Link to={`/company/${n.slug}`}>{n.name}</Link>
                  <span className="num">{n.when}</span>
                  <span className="field-hint">{n.basis}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Star a few companies and we’ll show their next windows here.</p>
          )}
        </section>
        <p className="field-hint">Stars and tracker carry into next season. Nothing here is shared.</p>
        <div className="set-actions">
          <Link to="/" className="btn btn-primary">
            Back to Home
          </Link>
          <Link to="/stars" className="btn btn-secondary">
            Star more companies
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="season-stat" role="listitem">
      <span className="num">{n}</span>
      <span>{label}</span>
    </div>
  );
}

function recapSvg(company: string, title: string, summer: number, stats: { applied: number; assessments: number; interviews: number }): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
  const t = title.length > 52 ? `${title.slice(0, 50)}…` : title;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5141D6"/><stop offset="1" stop-color="#A03C8A"/></linearGradient>
<radialGradient id="h" cx="0.85" cy="0" r="0.9"><stop offset="0" stop-color="#F1EBFC"/><stop offset="1" stop-color="#FFFFFF"/></radialGradient></defs>
<rect width="1200" height="630" fill="url(#h)"/>
<text x="80" y="120" font-family="Inter, Arial, sans-serif" font-size="28" fill="#66646F">Summer ${summer} internship</text>
<text x="80" y="230" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="84" fill="url(#g)">${esc(company)}</text>
<text x="80" y="295" font-family="Inter, Arial, sans-serif" font-size="34" fill="#0E0F1F">${esc(t)}</text>
<text x="80" y="450" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="64" fill="#0E0F1F">${stats.applied}</text>
<text x="80" y="490" font-family="Inter, Arial, sans-serif" font-size="24" fill="#565360">applications</text>
<text x="400" y="450" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="64" fill="#0E0F1F">${stats.interviews}</text>
<text x="400" y="490" font-family="Inter, Arial, sans-serif" font-size="24" fill="#565360">interviews</text>
<text x="80" y="570" font-family="Inter, Arial, sans-serif" font-size="22" fill="#66646F">Tracked with Fifteen · free for students</text>
</svg>`;
}

function RecapCard({ company, title, summer, stats }: { company: string; title: string; summer: number; stats: { applied: number; assessments: number; interviews: number } }) {
  const [status, setStatus] = useState<string | null>(null);
  const svg = recapSvg(company, title, summer, stats);
  const download = async () => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 630;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `fifteen-${summer}-offer.png`;
      a.click();
      setStatus('Saved the card as a PNG.');
    } catch {
      setStatus('Couldn’t make the image in this browser.');
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const copy = () => {
    const text = `I’m interning at ${company} this summer (${title}). ${plural(stats.applied, 'application')}, ${plural(stats.interviews, 'interview')}.`;
    void navigator.clipboard?.writeText(text).then(
      () => setStatus('Copied.'),
      () => setStatus('Couldn’t copy in this browser.'),
    );
  };
  return (
    <figure className="recap">
      <div className="recap-card" role="img" aria-label={`Recap card: ${company}, ${title}, ${stats.applied} applications, ${stats.interviews} interviews`} dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="set-actions">
        <button type="button" className="btn btn-primary" onClick={() => void download()}>
          Download card
        </button>
        <button type="button" className="btn btn-secondary" onClick={copy}>
          Copy text
        </button>
        {status ? (
          <span className="field-hint" role="status">
            {status}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
