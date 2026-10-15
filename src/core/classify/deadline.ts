/** Application deadline extraction -> ISO date (YYYY-MM-DD). */

const MONTH_INDEX: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_SRC = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

const TRIGGERS = new RegExp(
  [
    String.raw`apply\s+(?:by|before|no later than|on or before)`,
    String.raw`applications?\s+(?:are\s+|is\s+|will\s+|must\s+)?(?:be\s+)?(?:due|close|closes|closing|closed|accepted\s+until|open\s+until|must\s+be\s+(?:submitted|received)\s+(?:by|before))`,
    String.raw`application\s+(?:deadline|due\s+date|closing\s+date|close\s+date)`,
    String.raw`(?:closing|close)\s+date`,
    String.raw`deadline(?:\s+to\s+apply)?`,
    String.raw`submit\s+(?:[a-z]+\s+){0,3}?(?:by|before)`,
    String.raw`(?:must|should)\s+(?:be\s+)?(?:apply|applied|submitted|received)\s+(?:by|before)`,
    String.raw`(?:due|closes?)\s+(?:on|by)`,
  ].join('|'),
  'gi',
);

const DATE_RES: { re: RegExp; read: (m: RegExpExecArray) => { month: number; day: number; year: number | null } | null }[] = [
  // 2026-11-01
  {
    re: /\b(20\d\d)-(\d{1,2})-(\d{1,2})\b/,
    read: (m) => ({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }),
  },
  // Nov 1, 2026 / November 1st / Nov. 1
  {
    re: new RegExp(String.raw`\b(${MONTH_SRC})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(20\d\d))?`, 'i'),
    read: (m) => ({ month: MONTH_INDEX[(m[1] ?? '').toLowerCase()] ?? 0, day: Number(m[2]), year: m[3] ? Number(m[3]) : null }),
  },
  // 1 November 2026 / 1st of November
  {
    re: new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(${MONTH_SRC})\b\.?(?:,?\s+(20\d\d))?`, 'i'),
    read: (m) => ({ month: MONTH_INDEX[(m[2] ?? '').toLowerCase()] ?? 0, day: Number(m[1]), year: m[3] ? Number(m[3]) : null }),
  },
  // 11/01/2026, 11/1/26, 11/01
  {
    re: /(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/])/,
    read: (m) => {
      const y = m[3] ? Number(m[3]) : null;
      return { month: Number(m[1]), day: Number(m[2]), year: y === null ? null : y < 100 ? 2000 + y : y };
    },
  },
];

const NOT_A_DEADLINE_BETWEEN = /\b(start|starts|begin|begins|beginning|starting|runs|from|rolling|ongoing)\b/i;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function validDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/** First occurrence of month/day on or after (reference - 30 days). */
function inferYear(month: number, day: number, ref: Date): number | null {
  const floor = ref.getTime() - 30 * 86_400_000;
  const refYear = ref.getUTCFullYear();
  for (const year of [refYear, refYear + 1]) {
    if (!validDate(year, month, day)) continue;
    if (Date.UTC(year, month - 1, day) >= floor) return year;
  }
  return null;
}

export function extractDeadline(description: string, referenceIso: string): string | null {
  const ref = new Date(referenceIso);
  if (Number.isNaN(ref.getTime())) return null;
  const text = description.replaceAll(String.fromCharCode(160), ' ');

  for (const t of text.matchAll(TRIGGERS)) {
    const from = t.index + t[0].length;
    const window = text.slice(from, from + 60).split('\n')[0] ?? '';
    let best: { index: number; month: number; day: number; year: number | null } | null = null;
    for (const { re, read } of DATE_RES) {
      const m = re.exec(window);
      if (!m) continue;
      const parts = read(m);
      if (!parts) continue;
      if (!best || m.index < best.index) best = { index: m.index, ...parts };
    }
    if (!best) continue;
    if (NOT_A_DEADLINE_BETWEEN.test(window.slice(0, best.index))) continue;
    const year = best.year ?? inferYear(best.month, best.day, ref);
    if (year === null || !validDate(year, best.month, best.day)) continue;
    return `${year}-${pad(best.month)}-${pad(best.day)}`;
  }
  return null;
}
