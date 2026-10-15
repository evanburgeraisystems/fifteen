import { Link, useParams } from 'react-router';
import { labelCareer, labelIndustry } from '../../core/taxonomy.ts';
import { fmtComp } from '../../core/pay.ts';
import { Icon } from '../components/Icon.tsx';
import { useApp } from '../state/app-context.tsx';

/** Where demo links land: the posting text, clearly labeled as fictional. */
export function DemoPosting() {
  const { id = '' } = useParams();
  const { ds } = useApp();
  const p = ds.byId.get(decodeURIComponent(id)) ?? ds.snapshot.postings.find((x) => x.id === decodeURIComponent(id));

  return (
    <div className="demo-posting">
      <p className="notice" role="note">
        <Icon name="info" size={16} />
        <span>
          <strong>Demo data.</strong> This company and posting are fictional, made for testing Fifteen. Live data links straight to the employer’s own posting.
        </span>
      </p>
      {p ? (
        <article>
          <p className="crumb">
            {p.company} · {labelIndustry(p.classification.industry)} · {labelCareer(p.classification.career)}
          </p>
          <h1 className="page-title">{p.title}</h1>
          <p className="page-sub">
            {p.locations.join(' · ')}
            {p.compensation ? ` · ${fmtComp(p.compensation)}` : ''}
          </p>
          <div className="posting-body">{p.description}</div>
        </article>
      ) : (
        <div className="state">
          <h1 className="page-title">This demo posting isn’t in the current data</h1>
          <p>It may have been regenerated. Head back and pick another role.</p>
        </div>
      )}
      <Link to="/" className="btn btn-secondary">
        Back to Fifteen
      </Link>
    </div>
  );
}
