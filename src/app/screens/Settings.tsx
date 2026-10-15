import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { EMAIL_FIXTURES } from '../../core/email/fixtures.ts';
import { composeNotification } from '../../core/notify.ts';
import type { InboundEmail, Profile, Targets } from '../../core/types.ts';
import { setDatasetPreference, type DatasetId } from '../data/dataset.ts';
import { ForwardingSetup } from '../components/ForwardingSetup.tsx';
import { Icon } from '../components/Icon.tsx';
import { ProfileEditor } from '../components/ProfileEditor.tsx';
import { ResumeDrop } from '../components/ResumeDrop.tsx';
import { TargetsEditor, targetsValid } from '../components/TargetsEditor.tsx';
import { toast } from '../components/Toast.tsx';
import { fmtDate } from '../format.ts';
import { useApp } from '../state/app-context.tsx';
import { ingestEmail } from '../state/email-ingest.ts';
import { actions, resetState, type Theme } from '../state/store.ts';
import { useStarViews } from '../state/use-stars.ts';

export function Settings() {
  const { ds, state, ranked } = useApp();
  const stars = useStarViews();

  return (
    <div className="page settings">
      <header className="page-head">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Everything here is saved on this device. Fifteen is free for students.</p>
      </header>

      <div className="settings-grid">
      <TargetsSection key={JSON.stringify(state.targets)} />
      <ResumeSection key={state.resumeName ?? 'none'} />

      <section className="set-section" aria-labelledby="notif-h">
        <h2 id="notif-h" className="section-title">
          Notifications
        </h2>
        <p className="field-hint">Each one is optional. We only notify when there’s something new, never to say there’s nothing.</p>
        <Toggle
          label="New hits"
          hint="When roles in your targets are posted."
          on={state.notifications.newHits}
          onChange={(v) => actions.setNotifications({ newHits: v })}
        />
        <Toggle
          label="Star alerts"
          hint="When a starred company posts, is about to open, or has a deadline coming."
          on={state.notifications.starAlerts}
          onChange={(v) => actions.setNotifications({ starAlerts: v })}
        />
        <Toggle
          label="Weekly digest instead of daily"
          hint="One summary on Mondays."
          on={state.notifications.weeklyDigest}
          onChange={(v) => actions.setNotifications({ weeklyDigest: v })}
        />
        <NotificationPreview ranked={ranked} starCompanies={stars.filter((s) => s.fresh.length).map((s) => s.name)} />
      </section>

      <ForwardingSection />

      <section className="set-section" aria-labelledby="theme-h">
        <h2 id="theme-h" className="section-title">
          Appearance
        </h2>
        <div className="seg" role="radiogroup" aria-label="Theme">
          {(
            [
              ['system', 'System', 'monitor'],
              ['light', 'Light', 'sun'],
              ['dark', 'Dark', 'moon'],
            ] as const
          ).map(([id, label, icon]) => (
            <button key={id} type="button" role="radio" aria-checked={state.theme === id} className="seg-btn" onClick={() => actions.setTheme(id as Theme)}>
              <Icon name={icon} size={15} /> {label}
            </button>
          ))}
        </div>
      </section>

      <section className="set-section" aria-labelledby="season-h">
        <h2 id="season-h" className="section-title">
          Season
        </h2>
        <p className="field-hint">When your recruiting season is over, wrap it up. Stars and tracker carry into next season.</p>
        <Link to="/season" className="btn btn-secondary">
          Wrap up the season
        </Link>
      </section>

      <DataSection />

      <section className="set-section" aria-labelledby="reset-h">
        <h2 id="reset-h" className="section-title">
          Start over
        </h2>
        <p className="field-hint">Clears your resume, targets, stars and tracker from this device.</p>
        <ResetButton />
      </section>
      </div>
      <p className="field-hint settings-foot">
        {ds.isDemo ? 'Running on demo data.' : `Listings pulled ${fmtDate(ds.snapshot.pulledAt)}.`} Tracking since {fmtDate(ds.snapshot.trackingSince)}.
      </p>
    </div>
  );
}

function TargetsSection() {
  const { state } = useApp();
  const [draft, setDraft] = useState<Targets | null>(state.targets);
  if (!draft) return null;
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.targets);
  return (
    <section className="set-section" aria-labelledby="targets-h" id="targets">
      <h2 id="targets-h" className="section-title">
        Targets
      </h2>
      <TargetsEditor value={draft} onChange={(u) => setDraft((d) => (d ? u(d) : d))} />
      <div className="set-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!dirty || !targetsValid(draft)}
          onClick={() => {
            actions.setTargets(draft);
            toast('Targets saved. Everything re-ranked.');
          }}
        >
          Save targets
        </button>
        {dirty ? (
          <button type="button" className="btn btn-ghost" onClick={() => setDraft(state.targets)}>
            Discard changes
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ResumeSection() {
  const { state, ds } = useApp();
  const [draft, setDraft] = useState<Profile | null>(state.profile);
  const dirty = JSON.stringify(draft) !== JSON.stringify(state.profile);
  return (
    <section className="set-section" aria-labelledby="resume-h">
      <h2 id="resume-h" className="section-title">
        Resume
      </h2>
      <p className="field-hint">{state.resumeName ? `Using ${state.resumeName}.` : 'No resume yet. Roles can’t rank above Weak without one.'} A new upload re-ranks everything instantly.</p>
      <ResumeDrop
        compact
        nowIso={ds.nowIso()}
        onParsed={(p, name) => {
          actions.setProfile(p, name);
          setDraft(p);
          toast(`Read ${name}. Everything re-ranked.`);
        }}
      />
      {draft ? (
        <>
          <ProfileEditor value={draft} onChange={setDraft} />
          <div className="set-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!dirty}
              onClick={() => {
                actions.setProfile(draft, state.resumeName);
                toast('Profile saved. Everything re-ranked.');
              }}
            >
              Save profile
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  const id = `t-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className="toggle-row">
      <div>
        <span className="field-label" id={id}>
          {label}
        </span>
        <p className="field-hint">{hint}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={id} className="switch" onClick={() => onChange(!on)} />
    </div>
  );
}

function NotificationPreview({ ranked, starCompanies }: { ranked: ReturnType<typeof useApp>['ranked']; starCompanies: string[] }) {
  const { ds, state } = useApp();
  const n = useMemo(() => {
    const t = state.targets;
    const c = { perfect: 0, almost: 0, weak: 0 };
    for (const r of ranked) {
      if (r.posting.firstSeen !== ds.pullDate || r.fit.tier === 'nonfit') continue;
      const p = r.posting;
      if (t && (!t.industries.includes(p.classification.industry) || !t.careers.includes(p.classification.career) || !p.cities.some((x) => t.cities.includes(x)))) continue;
      c[r.fit.tier]++;
    }
    return composeNotification(state.notifications, { newByTier: c, starCompanies, todayIso: ds.nowIso() });
  }, [ranked, ds, state.targets, state.notifications, starCompanies]);
  return (
    <div className="preview" data-testid="notification-preview">
      <span className="field-label">Today’s notification</span>
      {n ? (
        <p>
          <strong>{n.title}.</strong> {n.body}
        </p>
      ) : (
        <p className="muted">None today. Nothing new matches your settings, so we stay quiet.</p>
      )}
    </div>
  );
}

function ForwardingSection() {
  const { state, ds } = useApp();
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const connected = state.forwarding.status === 'connected';

  const send = async (email: InboundEmail) => {
    setBusy(true);
    try {
      const r = await ingestEmail(email, ds);
      const msg: Record<typeof r.result, string> = {
        applied: 'Confirmed as applied and added to your tracker.',
        moved: 'Moved a tracker card.',
        unmatched: 'Couldn’t match it to a role you opened or applied to.',
        ignored: 'Not a recruiting update, so nothing changed.',
        'no-change': 'Already up to date.',
      };
      toast(msg[r.result]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="set-section" aria-labelledby="fwd-h" id="forwarding">
      <h2 id="fwd-h" className="section-title">
        Email forwarding
      </h2>
      {connected ? (
        <div className="toggle-row">
          <p>
            On. Forward to <code data-testid="forward-address">{state.forwarding.address}</code>
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => actions.setForwarding('off')}>
            Disconnect
          </button>
        </div>
      ) : (
        <ForwardingSetup onDone={() => actions.setForwarding('connected')} onSkip={() => actions.setForwarding('skipped')} />
      )}

      <details className="dev-tool" open={connected}>
        <summary>Paste a forwarded email</summary>
        <p className="field-hint">Paste the whole email, including the From and Subject lines. It’s read on this device.</p>
        <label className="sr-only" htmlFor="raw-email">
          Email text
        </label>
        <textarea
          id="raw-email"
          className="input"
          rows={6}
          value={raw}
          placeholder={'From: Peachtree Brands <no-reply@greenhouse-mail.io>\nSubject: Thank you for applying\n\nHi, thanks for applying to the Marketing Intern role…'}
          onChange={(e) => setRaw(e.target.value)}
        />
        <div className="set-actions">
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !raw.trim()} onClick={() => void send(parseRawEmail(raw, ds.nowIso())).then(() => setRaw(''))}>
            Process email
          </button>
          {ds.isDemo ? (
            <>
              <label className="sr-only" htmlFor="fixture-email">
                Load a sample email
              </label>
              <select
                id="fixture-email"
                className="filter-btn select"
                value=""
                onChange={(e) => {
                  const f = EMAIL_FIXTURES.find((x) => x.id === e.target.value);
                  if (f) void send({ ...f, id: `${f.id}-${Date.now()}` });
                }}
              >
                <option value="">Send a sample email (demo)</option>
                {EMAIL_FIXTURES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.subject.slice(0, 60)}
                  </option>
                ))}
              </select>
            </>
          ) : null}
        </div>
      </details>

      {state.emails.length ? (
        <div className="email-log">
          <h3 className="field-label">Recent forwarded emails</h3>
          <ul>
            {state.emails.slice(0, 8).map((e) => (
              <li key={e.id}>
                <span className="email-subj">{e.subject}</span>
                <span className="muted">
                  {e.kind.replace('-', ' ')} · {e.undone ? 'undone' : e.result}
                </span>
                {!e.undone && (e.result === 'moved' || e.result === 'applied') ? (
                  <button type="button" className="link-btn" onClick={() => actions.undoEmail(e.id)}>
                    Undo
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/** Minimal parser for a pasted email: header lines until the first blank line, then body. */
export function parseRawEmail(raw: string, nowIso: string): InboundEmail {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  let from = '';
  let subject = '';
  let i = 0;
  for (; i < lines.length; i++) {
    const l = lines[i] ?? '';
    if (!l.trim()) break;
    const m = /^(from|subject|to|date)\s*:\s*(.*)$/i.exec(l);
    if (!m) break;
    if (m[1]?.toLowerCase() === 'from') from = m[2] ?? '';
    if (m[1]?.toLowerCase() === 'subject') subject = m[2] ?? '';
  }
  const body = lines.slice(i).join('\n').trim();
  return { id: `paste-${Date.now()}`, from, subject, body, receivedAt: nowIso };
}

function DataSection() {
  const { ds } = useApp();
  const choose = (id: DatasetId) => {
    setDatasetPreference(id);
    window.location.assign(`/?dataset=${id}`);
  };
  return (
    <section className="set-section" aria-labelledby="data-h">
      <h2 id="data-h" className="section-title">
        Listings data
      </h2>
      <p className="field-hint">
        Live data comes from companies’ own public job boards, pulled daily. Demo data is fictional and exists for testing.
      </p>
      <div className="seg" role="radiogroup" aria-label="Listings data">
        {(
          [
            ['live', 'Live'],
            ['demo', 'Demo'],
            ['demo-zero', 'Demo, quiet day'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={ds.id === id} className="seg-btn" onClick={() => choose(id)}>
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function ResetButton() {
  const [confirm, setConfirm] = useState(false);
  if (!confirm)
    return (
      <button type="button" className="btn btn-danger" onClick={() => setConfirm(true)}>
        Clear everything
      </button>
    );
  return (
    <div className="set-actions">
      <span>This can’t be undone.</span>
      <button
        type="button"
        className="btn btn-danger"
        onClick={() => {
          resetState();
          window.location.assign('/welcome');
        }}
      >
        Yes, clear everything
      </button>
      <button type="button" className="btn btn-secondary" onClick={() => setConfirm(false)}>
        Keep my data
      </button>
    </div>
  );
}
