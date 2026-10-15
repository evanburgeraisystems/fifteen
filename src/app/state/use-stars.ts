import { useMemo } from 'react';
import { starEvents, unacknowledged, type StarEvent } from '../../core/stars.ts';
import { predictCompanyWindow, type CompanyWindow } from '../../core/windows.ts';
import { useApp } from './app-context.tsx';

export interface StarView {
  slug: string;
  name: string;
  alerts: boolean;
  window: CompanyWindow;
  events: StarEvent[];
  /** Unacknowledged events: the card glows while this is non-empty. */
  fresh: StarEvent[];
}

export function useStarViews(): StarView[] {
  const { ds, state } = useApp();
  return useMemo(() => {
    const now = ds.nowIso();
    const applied = new Set(Object.entries(state.statuses).filter(([, v]) => v.status === 'applied').map(([k]) => k));
    return Object.entries(state.stars)
      .map(([slug, st]) => {
        const window = predictCompanyWindow(slug, ds.visible, ds.history, now);
        const events = starEvents(slug, ds.visible, window, applied, now);
        return { slug, name: st.name, alerts: st.alerts, window, events, fresh: unacknowledged(events, st) };
      })
      .sort((a, b) => b.fresh.length - a.fresh.length || a.name.localeCompare(b.name));
  }, [ds, state.stars, state.statuses]);
}
