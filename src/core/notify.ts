/**
 * Notification composer. Calm by design: a notification exists only when
 * something is new. There is no "0 new roles" message, ever.
 */
export interface NotificationPrefs {
  newHits: boolean;
  starAlerts: boolean;
  weeklyDigest: boolean;
}

export interface NotificationInput {
  /** New roles today within targets, by tier. */
  newByTier: { perfect: number; almost: number; weak: number };
  /** Starred companies with unacknowledged events. */
  starCompanies: string[];
  /** ISO date; weekly digests only go out on this weekday. */
  todayIso: string;
  digestWeekday?: number; // 0=Sun..6=Sat, default Monday
  /** For weekly digest: totals over the past 7 days. */
  weekNewTotal?: number;
}

export interface Notification {
  title: string;
  body: string;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function composeNotification(prefs: NotificationPrefs, input: NotificationInput): Notification | null {
  const { perfect, almost, weak } = input.newByTier;
  const hits = perfect + almost + weak;
  const lines: string[] = [];

  if (prefs.weeklyDigest) {
    const weekday = new Date(Date.parse(input.todayIso)).getUTCDay();
    if (weekday !== (input.digestWeekday ?? 1)) return null;
    const week = input.weekNewTotal ?? 0;
    if (week > 0 && prefs.newHits) lines.push(`${plural(week, 'new role')} this week in your targets.`);
    if (prefs.starAlerts && input.starCompanies.length) lines.push(`News at ${input.starCompanies.slice(0, 3).join(', ')}.`);
    return lines.length ? { title: 'Your week in roles', body: lines.join(' ') } : null;
  }

  if (prefs.newHits && hits > 0) {
    const parts = [perfect && `${perfect} Perfect`, almost && `${almost} Almost`, weak && `${weak} Weak`].filter(Boolean);
    lines.push(`${parts.join(' · ')} new today.`);
  }
  if (prefs.starAlerts && input.starCompanies.length) {
    lines.push(`News at ${input.starCompanies.slice(0, 3).join(', ')}.`);
  }
  if (!lines.length) return null;
  return { title: hits > 0 ? plural(hits, 'new role') : 'Starred companies', body: lines.join(' ') };
}
