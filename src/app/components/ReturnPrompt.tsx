import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../state/app-context.tsx';
import { actions } from '../state/store.ts';

/**
 * The single quiet "Applied? Yes / Not yet" prompt. It appears when the student
 * comes back to the app (page load or returning to the tab) and a role they
 * opened isn't confirmed yet. One at a time; "Not yet" waits for the next return.
 */
export function ReturnPrompt() {
  const { ds, state } = useApp();
  const [returnedAt, setReturnedAt] = useState<string>(() => new Date().toISOString());
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let leftAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') leftAt = Date.now();
      else if (leftAt) {
        setReturnedAt(new Date().toISOString());
        setHidden(false);
      }
    };
    const onFocus = () => {
      if (leftAt) return;
      // Link clicks open a new tab; coming back to this one fires focus.
      setReturnedAt(new Date().toISOString());
      setHidden(false);
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const candidate = useMemo(() => {
    const opened = Object.entries(state.statuses)
      .filter(([, v]) => v.status === 'opened')
      // opened before this return, and not snoozed since the last return
      .filter(([, v]) => v.at < returnedAt && (!v.snoozedAt || v.snoozedAt < returnedAt))
      .sort((a, b) => (a[1].at < b[1].at ? 1 : -1));
    for (const [id] of opened) {
      const p = ds.byId.get(id);
      if (p) return p;
    }
    return null;
  }, [state.statuses, returnedAt, ds]);

  if (!state.onboarded || !candidate || hidden) return null;

  return (
    <div className="prompt" role="dialog" aria-modal="false" aria-label="Did you apply?" data-testid="return-prompt">
      <p>
        Applied to <strong>{candidate.title}</strong> <span>at {candidate.company}?</span>
      </p>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => {
          actions.markApplied(candidate, ds.nowIso());
        }}
      >
        Yes
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => {
          actions.snoozePrompt(candidate.id, new Date().toISOString());
          setHidden(true);
        }}
      >
        Not yet
      </button>
    </div>
  );
}
