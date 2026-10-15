/** Inline SVG icons (1.75px strokes, 20px grid). Decorative unless given a title. */
import type { ReactElement } from 'react';

export type IconName =
  | 'home'
  | 'list'
  | 'board'
  | 'star'
  | 'star-filled'
  | 'settings'
  | 'search'
  | 'check'
  | 'check-shield'
  | 'external'
  | 'info'
  | 'x'
  | 'chevron-down'
  | 'chevron-right'
  | 'arrow-right'
  | 'mail'
  | 'upload'
  | 'undo'
  | 'bell'
  | 'grip'
  | 'calendar'
  | 'dollar'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'sparkle'
  | 'clock'
  | 'alert';

const P: Record<IconName, ReactElement> = {
  home: <path d="M3.5 9 10 3.75 16.5 9v7.25a.75.75 0 0 1-.75.75H12.5v-4.5h-5V17H4.25a.75.75 0 0 1-.75-.75z" />,
  list: (
    <>
      <path d="M7 5.5h9.5M7 10h9.5M7 14.5h9.5" />
      <circle cx="3.75" cy="5.5" r=".9" fill="currentColor" />
      <circle cx="3.75" cy="10" r=".9" fill="currentColor" />
      <circle cx="3.75" cy="14.5" r=".9" fill="currentColor" />
    </>
  ),
  board: (
    <>
      <rect x="3" y="3.5" width="4" height="13" rx="1.2" />
      <rect x="8.5" y="3.5" width="4" height="9" rx="1.2" />
      <rect x="14" y="3.5" width="3" height="6" rx="1.2" />
    </>
  ),
  star: <path d="m10 3 2.1 4.4 4.8.6-3.5 3.3.9 4.8L10 13.8l-4.3 2.3.9-4.8L3.1 8l4.8-.6z" strokeLinejoin="round" />,
  'star-filled': <path d="m10 3 2.1 4.4 4.8.6-3.5 3.3.9 4.8L10 13.8l-4.3 2.3.9-4.8L3.1 8l4.8-.6z" fill="currentColor" strokeLinejoin="round" />,
  settings: (
    <>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.75v2M10 15.25v2M17.25 10h-2M4.75 10h-2M15.1 4.9l-1.4 1.4M6.3 13.7l-1.4 1.4M15.1 15.1l-1.4-1.4M6.3 6.3 4.9 4.9" />
    </>
  ),
  search: (
    <>
      <circle cx="8.75" cy="8.75" r="5" />
      <path d="m12.5 12.5 4 4" />
    </>
  ),
  check: <path d="m4.5 10.5 3.5 3.5 7.5-8" />,
  'check-shield': (
    <>
      <path d="M10 2.75 4 5v4.6c0 3.5 2.5 6.2 6 7.65 3.5-1.45 6-4.15 6-7.65V5z" />
      <path d="m7.25 10 2 2 3.5-4" />
    </>
  ),
  external: <path d="M11.5 3.75h4.75V8.5M16 4 9.5 10.5M14 12v3.25a1 1 0 0 1-1 1H4.75a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H8" />,
  info: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9v4.5M10 6.5v.01" />
    </>
  ),
  x: <path d="m5 5 10 10M15 5 5 15" />,
  'chevron-down': <path d="m5.5 8 4.5 4.5L14.5 8" />,
  'chevron-right': <path d="m8 5.5 4.5 4.5L8 14.5" />,
  'arrow-right': <path d="M4 10h11.5M11 5.5l4.5 4.5-4.5 4.5" />,
  mail: (
    <>
      <rect x="3" y="4.75" width="14" height="10.5" rx="1.5" />
      <path d="m3.5 5.5 6.5 5 6.5-5" />
    </>
  ),
  upload: <path d="M10 13V3.75M6 7.5l4-4 4 4M4 13.5v1.75c0 .55.45 1 1 1h10c.55 0 1-.45 1-1V13.5" />,
  undo: <path d="M7.5 5.5 4 9l3.5 3.5M4.5 9H12a4 4 0 0 1 0 8h-2" />,
  bell: <path d="M5.5 13.5V9a4.5 4.5 0 0 1 9 0v4.5l1.25 1.5H4.25zM8.25 16.5a1.75 1.75 0 0 0 3.5 0" />,
  grip: (
    <>
      {[6.5, 10, 13.5].map((y) =>
        [7.5, 12.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="currentColor" stroke="none" />),
      )}
    </>
  ),
  calendar: (
    <>
      <rect x="3.25" y="4.5" width="13.5" height="12" rx="1.5" />
      <path d="M3.25 8.25h13.5M7 3v3M13 3v3" />
    </>
  ),
  dollar: <path d="M10 3v14M13.5 6.5c-.6-1-1.9-1.6-3.5-1.6-2 0-3.5 1-3.5 2.6 0 3.7 7.2 1.8 7.2 5.2 0 1.7-1.6 2.7-3.7 2.7-1.8 0-3.1-.7-3.7-1.8" />,
  sun: (
    <>
      <circle cx="10" cy="10" r="3.25" />
      <path d="M10 2.5v1.75M10 15.75v1.75M17.5 10h-1.75M4.25 10H2.5M15.3 4.7l-1.25 1.25M5.95 14.05 4.7 15.3M15.3 15.3l-1.25-1.25M5.95 5.95 4.7 4.7" />
    </>
  ),
  moon: <path d="M15.5 12.4A6.25 6.25 0 0 1 7.6 4.5a6.25 6.25 0 1 0 7.9 7.9z" />,
  monitor: (
    <>
      <rect x="2.75" y="3.75" width="14.5" height="10" rx="1.5" />
      <path d="M7.5 16.5h5M10 13.75v2.75" />
    </>
  ),
  sparkle: <path d="M10 3.5 11.4 8.6 16.5 10l-5.1 1.4L10 16.5l-1.4-5.1L3.5 10l5.1-1.4z" strokeLinejoin="round" />,
  clock: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.75 1.75" />
    </>
  ),
  alert: (
    <>
      <path d="M10 3.25 17.25 16H2.75z" strokeLinejoin="round" />
      <path d="M10 8.25v3.5M10 13.75v.01" />
    </>
  ),
};

export function Icon({ name, size = 18, title, className }: { name: IconName; size?: number; title?: string; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {P[name]}
    </svg>
  );
}
