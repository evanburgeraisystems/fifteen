import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { classYearFromGrad } from '../../core/resume/profile.ts';
import { labelIndustry } from '../../core/taxonomy.ts';
import type { Profile, Targets } from '../../core/types.ts';
import { ForwardingSetup } from '../components/ForwardingSetup.tsx';
import { Icon } from '../components/Icon.tsx';
import { ProfileEditor } from '../components/ProfileEditor.tsx';
import { ResumeDrop } from '../components/ResumeDrop.tsx';
import { TargetsEditor, targetsValid } from '../components/TargetsEditor.tsx';
import { useApp } from '../state/app-context.tsx';
import { actions } from '../state/store.ts';

type Step = 'resume' | 'confirm' | 'forward' | 'stars';
const STEPS: Step[] = ['resume', 'confirm', 'forward', 'stars'];
const STEP_LABEL: Record<Step, string> = { resume: 'Resume', confirm: 'Targets', forward: 'Email', stars: 'Stars' };

const EMPTY_PROFILE: Profile = {
  name: null,
  email: null,
  school: null,
  majors: [],
  gpa: null,
  gradYear: null,
  skills: [],
  coursework: [],
  experience: [],
  wordCount: 0,
};

export function Onboarding() {
  const { ds, state, companies } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('resume');
  const [profile, setProfile] = useState<Profile | null>(state.profile);
  const [resumeName, setResumeName] = useState<string | null>(state.resumeName);
  const [targets, setTargets] = useState<Targets>(
    state.targets ?? { classYear: 'sophomore', industries: [], careers: [], cities: [], payFloorHourly: null },
  );
  const [picked, setPicked] = useState<string[]>(Object.keys(state.stars));

  const suggestions = useMemo(() => {
    const score = new Map<string, number>();
    for (const p of ds.visible) {
      const s =
        (targets.industries.includes(p.classification.industry) ? 2 : 0) +
        (targets.careers.includes(p.classification.career) ? 2 : 0) +
        (p.cities.some((c) => targets.cities.includes(c)) ? 1 : 0);
      if (s >= 3) score.set(p.companySlug, (score.get(p.companySlug) ?? 0) + s);
    }
    return companies
      .filter((c) => score.has(c.slug))
      .sort((a, b) => (score.get(b.slug) ?? 0) - (score.get(a.slug) ?? 0))
      .slice(0, 12);
  }, [ds, companies, targets]);

  if (state.onboarded && state.targets) return <Navigate to="/" replace />;

  const idx = STEPS.indexOf(step);
  const finish = () => {
    const now = ds.nowIso();
    actions.setProfile(profile, resumeName);
    actions.setTargets(targets);
    for (const slug of picked) {
      const c = companies.find((x) => x.slug === slug);
      if (c && !state.stars[slug]) actions.toggleStar(slug, c.name, now);
    }
    actions.finishOnboarding();
    navigate('/', { replace: true });
  };

  return (
    <div className="onboard">
      <div className="onboard-grid" aria-hidden="true" />
      <header className="onboard-top">
        <span className="brand">
          <span className="brand-tile" aria-hidden="true">
            15
          </span>
          Fifteen
        </span>
        {ds.isDemo ? <span className="demo-pill">Demo data</span> : null}
      </header>
      <ol className="steps" aria-label="Setup steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i < idx ? 'is-done' : i === idx ? 'is-current' : ''} aria-current={i === idx ? 'step' : undefined}>
            <span className="step-dot">{i < idx ? <Icon name="check" size={12} /> : i + 1}</span>
            {STEP_LABEL[s]}
          </li>
        ))}
      </ol>

      <main className="onboard-body" id="main">
        {step === 'resume' ? (
          <section aria-labelledby="ob-h">
            <h1 id="ob-h" className="onboard-title">
              Every business internship, ranked for <span className="serif-accent gradient-text">you.</span>
            </h1>
            <p className="onboard-sub">Drop your resume. We match it against what each posting asks for. Free for students, always.</p>
            <ResumeDrop
              nowIso={ds.nowIso()}
              onParsed={(p, name) => {
                setProfile(p);
                setResumeName(name);
                const cy = classYearFromGrad(p.gradYear, ds.nowIso());
                if (cy && cy !== 'senior') setTargets((t) => ({ ...t, classYear: cy }));
                setStep('confirm');
              }}
            />
            <p className="onboard-skip">
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setProfile(EMPTY_PROFILE);
                  setStep('confirm');
                }}
              >
                Continue without a resume
              </button>{' '}
              <span className="muted">· roles can’t rank above Weak until you add one</span>
            </p>
          </section>
        ) : null}

        {step === 'confirm' && profile ? (
          <section aria-labelledby="ob-h">
            <h1 id="ob-h" className="onboard-title">
              Check what we read
            </h1>
            <p className="onboard-sub">
              {resumeName ? (
                <>
                  From <strong>{resumeName}</strong>
                  {profile.wordCount ? ` · ${profile.wordCount} words` : ''}. Fix anything we got wrong.
                </>
              ) : (
                'Add your skills so we can rank roles for you.'
              )}
            </p>
            <ProfileEditor value={profile} onChange={setProfile} />
            <h2 className="onboard-h2">What you’re looking for</h2>
            <TargetsEditor value={targets} onChange={setTargets} />
            <div className="onboard-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep('resume')}>
                Back
              </button>
              <button type="button" className="btn btn-primary" disabled={!targetsValid(targets)} onClick={() => setStep('forward')}>
                Continue <Icon name="arrow-right" size={16} />
              </button>
            </div>
          </section>
        ) : null}

        {step === 'forward' ? (
          <section aria-labelledby="ob-h">
            <h1 id="ob-h" className="onboard-title">
              Optional: let emails move your tracker
            </h1>
            <ForwardingSetup
              onDone={() => {
                actions.setForwarding('connected');
                setStep('stars');
              }}
              onSkip={() => {
                actions.setForwarding('skipped');
                setStep('stars');
              }}
            />
          </section>
        ) : null}

        {step === 'stars' ? (
          <section aria-labelledby="ob-h">
            <h1 id="ob-h" className="onboard-title">
              Optional: star a few companies
            </h1>
            <p className="onboard-sub">Starred companies light up when they post, are about to open, or have a deadline coming.</p>
            {suggestions.length === 0 ? (
              <p className="muted">No suggestions for these targets yet. You can star companies anytime.</p>
            ) : (
              <div className="chip-row" role="group" aria-label="Suggested companies">
                {suggestions.map((c) => (
                  <button
                    key={c.slug}
                    type="button"
                    className="chip"
                    aria-pressed={picked.includes(c.slug)}
                    onClick={() => setPicked((p) => (p.includes(c.slug) ? p.filter((x) => x !== c.slug) : [...p, c.slug]))}
                  >
                    <Icon name={picked.includes(c.slug) ? 'star-filled' : 'star'} size={14} />
                    {c.name}
                    <span className="muted">· {labelIndustry(c.industry)}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="onboard-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep('forward')}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={finish} data-testid="finish-onboarding">
                {picked.length ? `Build my list with ${picked.length} star${picked.length === 1 ? '' : 's'}` : 'Build my list'}
                <Icon name="arrow-right" size={16} />
              </button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
