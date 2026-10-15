import { useEffect, useRef, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { Icon, type IconName } from './components/Icon.tsx';
import { ReturnPrompt } from './components/ReturnPrompt.tsx';
import { ToastHost } from './components/Toast.tsx';
import { useApp } from './state/app-context.tsx';

const TABS: { to: string; label: string; short: string; icon: IconName }[] = [
  { to: '/', label: 'Home', short: 'Home', icon: 'home' },
  { to: '/jobs', label: 'Every Job Listing', short: 'Listings', icon: 'list' },
  { to: '/tracker', label: 'Tracker', short: 'Tracker', icon: 'board' },
  { to: '/stars', label: 'Stars', short: 'Stars', icon: 'star' },
];

export function Shell({ children }: { children: ReactNode }) {
  const { ds } = useApp();
  const navigate = useNavigate();
  const loc = useLocation();

  // Keyboard: 1-4 switch tabs, "/" jumps to search on Every Job Listing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i >= 0) {
        const tab = TABS[i];
        if (tab) navigate(tab.to);
      } else if (e.key === '/') {
        e.preventDefault();
        if (loc.pathname !== '/jobs') navigate('/jobs?focus=search');
        else document.getElementById('job-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, loc.pathname]);

  // On navigation (not the first load), move focus to the page so screen readers
  // announce the new screen. Skip it when the URL asks a screen to focus a field.
  const prev = useRef(loc.pathname);
  useEffect(() => {
    if (prev.current === loc.pathname) return;
    prev.current = loc.pathname;
    window.scrollTo(0, 0);
    if (new URLSearchParams(loc.search).has('focus')) return;
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [loc.pathname, loc.search]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Fifteen, home">
          <span className="brand-tile" aria-hidden="true">
            15
          </span>
          Fifteen
        </Link>
        <nav className="nav" aria-label="Main">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === '/'}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-end">
          {ds.isDemo ? (
            <span className="demo-pill" title="Fictional companies and roles for testing. Not real postings." data-testid="demo-label">
              Demo data
            </span>
          ) : null}
          <NavLink to="/settings" className="icon-btn icon-btn-md" aria-label="Settings" title="Settings">
            <Icon name="settings" size={19} />
          </NavLink>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}>
            <Icon name={t.icon} size={20} />
            {t.short}
          </NavLink>
        ))}
      </nav>
      <ReturnPrompt />
      <ToastHost />
    </div>
  );
}
