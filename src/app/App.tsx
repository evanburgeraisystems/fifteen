import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { Icon } from './components/Icon.tsx';
import { loadDataset, type Dataset } from './data/dataset.ts';
import { Company } from './screens/Company.tsx';
import { DemoPosting } from './screens/DemoPosting.tsx';
import { Home } from './screens/Home.tsx';
import { Jobs } from './screens/Jobs.tsx';
import { NotFound } from './screens/NotFound.tsx';
import { Onboarding } from './screens/Onboarding.tsx';
import { SeasonClose } from './screens/SeasonClose.tsx';
import { Settings } from './screens/Settings.tsx';
import { Stars } from './screens/Stars.tsx';
import { Tracker } from './screens/Tracker.tsx';
import { Shell } from './Shell.tsx';
import { AppProvider, useApp } from './state/app-context.tsx';
import { actions, useAppState } from './state/store.ts';

function useTheme() {
  const { theme } = useAppState();
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const t = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      root.dataset.theme = t;
      try {
        localStorage.setItem('fifteen.theme', theme === 'system' ? '' : theme);
      } catch {
        /* ignore */
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export function App() {
  useTheme();
  const [ds, setDs] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    loadDataset()
      .then((d) => {
        if (!alive) return;
        setDs(d);
        setError(null);
        actions.beginVisit();
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (error) return <LoadError message={error} onRetry={() => setAttempt((a) => a + 1)} />;
  if (!ds) return <Loading />;
  return (
    <BrowserRouter>
      <AppProvider ds={ds}>
        <Routes>
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="/demo-posting/:id" element={<DemoPosting />} />
          <Route path="*" element={<Guarded />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}

function Guarded() {
  const { state } = useApp();
  const loc = useLocation();
  if (!state.onboarded || !state.targets) return <Navigate to="/welcome" replace state={{ from: loc.pathname }} />;
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/tracker" element={<Tracker />} />
        <Route path="/stars" element={<Stars />} />
        <Route path="/company/:slug" element={<Company tab="roles" />} />
        <Route path="/company/:slug/pay" element={<Company tab="pay" />} />
        <Route path="/company/:slug/cycle" element={<Company tab="cycle" />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/season" element={<SeasonClose />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  );
}

function Loading() {
  return (
    <div className="boot" role="status" aria-live="polite" aria-label="Loading today’s roles">
      <div className="boot-brand">
        <span className="brand-tile" aria-hidden="true">
          15
        </span>
        <span>Loading today’s roles…</span>
      </div>
      <div className="boot-lanes" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="boot-lane">
            <div className="skeleton boot-bar" />
            {[0, 1, 2].map((j) => (
              <div key={j} className="skeleton boot-row" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="boot">
      <div className="state state-error" role="alert">
        <span className="state-icon">
          <Icon name="alert" />
        </span>
        <h1 className="page-title">Couldn’t load roles</h1>
        <p>We couldn’t reach today’s listings file. Your tracker and stars are saved on this device and are safe.</p>
        <p className="muted">{message}</p>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}
