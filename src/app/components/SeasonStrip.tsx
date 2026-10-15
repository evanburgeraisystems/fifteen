import { useState } from 'react';
import { labelIndustry } from '../../core/taxonomy.ts';
import type { IndustryId } from '../../core/types.ts';
import { seasonFor, type Season } from '../../core/windows.ts';
import { useApp } from '../state/app-context.tsx';

const PROGRESS: Record<NonNullable<Season['phase']>, number> = {
  early: 0.04,
  opening: 0.2,
  peak: 0.5,
  late: 0.82,
  closed: 1,
};

/**
 * One line, scoped to one industry at a time: "Finance · Peak · week 3 of 8".
 * With several industries selected, the industry name cycles through them.
 */
export function SeasonStrip({ industries }: { industries: IndustryId[] }) {
  const { ds } = useApp();
  const [i, setI] = useState(0);
  if (industries.length === 0) return null;
  const industry = industries[i % industries.length] ?? industries[0];
  if (!industry) return null;
  const s = seasonFor(industry, ds.history, ds.visible, ds.nowIso());
  const rest = s.line.slice(labelIndustry(industry).length + 3);
  const many = industries.length > 1;
  const pct = s.phase && s.week && s.weeks ? Math.min(1, PROGRESS[s.phase] * 0.6 + (s.week / s.weeks) * 0.4) : s.phase ? PROGRESS[s.phase] : 0;

  return (
    <div className="season" data-testid="season-strip">
      <button
        type="button"
        className="season-industry"
        onClick={() => setI((n) => n + 1)}
        disabled={!many}
        aria-label={many ? `Season for ${labelIndustry(industry)}. Show next industry` : `Season for ${labelIndustry(industry)}`}
      >
        {labelIndustry(industry)}
      </button>
      <span aria-hidden="true">·</span>
      <span>{rest}</span>
      {s.phase ? (
        <span className="season-track" role="img" aria-label={`${Math.round(pct * 100)}% through the season`}>
          <span style={{ width: `${Math.round(pct * 100)}%` }} />
        </span>
      ) : null}
    </div>
  );
}
