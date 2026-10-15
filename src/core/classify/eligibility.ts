/** Class-year eligibility extraction ("rising junior", "Class of 2028", ...). */
import { gradYearFor, risingToGradYear } from '../cycle.ts';
import type { ClassYear, Eligibility } from '../types.ts';

interface Hit {
  index: number;
  end: number;
  phrase: string;
  years: number[];
}

const CLASS_WORD = /\b(freshmen|freshman|sophomores?|juniors?|seniors?)\b/gi;
const STUDENT_CONTEXT =
  /\b(student|students|undergrad|undergraduate|undergraduates|college|university|universities|eligible|eligibility|applicants?|candidates?|program|programme|open to|class)\b/i;
const JOB_NOUN_AFTER =
  /^\s+(manager|analyst|associate|director|engineer|vp|leader|leaders|leadership|level|executive|developer|accountant|consultant|specialist|partner|designer|recruiter|staff|member|management|citizens?)\b/i;
const CHAIN_GAP = /^\s*(?:,|\/|&|and|or|,\s*and|,\s*or|and\/or)?\s*(?:rising\s+|current\s+)?$/i;

function toClassYear(word: string): ClassYear {
  const w = word.toLowerCase();
  if (w.startsWith('fresh')) return 'freshman';
  if (w.startsWith('soph')) return 'sophomore';
  if (w.startsWith('jun')) return 'junior';
  return 'senior';
}

function risingYear(cls: ClassYear, summerYear: number): number {
  return risingToGradYear(cls, summerYear) ?? summerYear + 4;
}

type Mode = 'rising' | 'current';

interface ClassMention {
  index: number;
  end: number;
  word: string;
  cls: ClassYear;
  mode: Mode;
  valid: boolean;
}

/** Find class words that are used as a student's year, not as a seniority level of a job. */
function scanClassWords(text: string): ClassMention[] {
  const out: ClassMention[] = [];
  let prev: ClassMention | null = null;
  for (const m of text.matchAll(CLASS_WORD)) {
    const index = m.index;
    const word = m[1] ?? '';
    const end = index + word.length;
    const cls = toClassYear(word);
    const before = text.slice(Math.max(0, index - 48), index);
    const after = text.slice(end, end + 40);
    const lower = word.toLowerCase();
    const plural = lower === 'freshmen' || (lower.endsWith('s') && lower !== 'sophomore');

    let mode: Mode = 'current';
    let valid = false;
    let chained = false;

    // Lists: "sophomore or junior", "rising juniors and seniors" inherit from the first member.
    if (prev && prev.valid && index - prev.end <= 14 && CHAIN_GAP.test(text.slice(prev.end, index))) {
      mode = prev.mode;
      valid = true;
      chained = true;
    }

    if (!chained) {
      const ctxWindow = text.slice(Math.max(0, index - 100), end + 100);
      if (/\brising\s+(?:undergraduate\s+)?$/i.test(before)) {
        mode = 'rising';
        valid = true;
      } else if (/\bentering\s+(?:your|their|his or her|the)\s+$/i.test(before) && /^\s+year\b/i.test(after)) {
        mode = 'rising';
        valid = true;
      } else if (
        /\bcurrent(?:ly)?\s+(?:an?\s+|the\s+)?(?:undergraduate\s+)?$/i.test(before) ||
        /\benrolled\s+(?:as|in)\s+(?:an?\s+|their\s+|your\s+)(?:undergraduate\s+)?$/i.test(before)
      ) {
        valid = true;
      } else if (/^(?:sophomores?|freshman|freshmen)$/i.test(word)) {
        valid = true; // unambiguous class words
      } else if (/^\s+(?:year|students?|undergraduates?|undergrads?|class|standing|status|cohort)\b/i.test(after)) {
        valid = true;
      } else if (
        /\b(?:as|be|are|is|a|an|their|your)\s+(?:an?\s+)?$/i.test(before) &&
        /^\s*(?:$|[,.;:)]|and\b|or\b|who\b|at\b|in\b)/i.test(after) &&
        STUDENT_CONTEXT.test(ctxWindow)
      ) {
        valid = true;
      } else if (plural && STUDENT_CONTEXT.test(ctxWindow)) {
        valid = true;
      }
      if (valid && /^(?:junior|senior)s?$/i.test(word) && JOB_NOUN_AFTER.test(after)) valid = false;
    }

    const mention: ClassMention = { index, end, word, cls, mode, valid };
    out.push(mention);
    prev = mention;
  }
  return out;
}

const MONTH_WORDS = /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b\.?/gi;
const GRAD_ANCHOR = new RegExp(
  [
    'graduat(?:e|es|ed|ing|ion)',
    'class(?:es)?\\s+of',
    'expected\\s+(?:graduation|completion|degree|to\\s+(?:graduate|complete|earn))',
    'anticipated\\s+(?:graduation|completion)',
    'degree\\s+(?:completion|conferral|date)',
    'date\\s+of\\s+graduation',
  ].join('|'),
  'gi',
);
const NOT_A_CLASS_YEAR_TAIL = /^\s*(?:degree|program|programme|school|student|level|studies|study|from|with|or\s+professional)/;

function sentenceWindow(text: string, from: number, max: number): string {
  const rest = text.slice(from, from + max);
  const stop = rest.search(/\n|[.;]\s+(?=[A-Z•])|[.;]$/);
  return stop >= 0 ? rest.slice(0, stop) : rest;
}

function yearsInWindow(win: string, lo: number, hi: number): number[] {
  const ys: number[] = [];
  for (const m of win.matchAll(/(?<![\d$,.])(20\d\d)(?!\d)/g)) {
    const y = Number(m[1]);
    if (y >= lo && y <= hi) ys.push(y);
  }
  return ys;
}

function scanGradYears(text: string, summerYear: number): Hit[] {
  const hits: Hit[] = [];
  const lo = summerYear - 1;
  const hi = summerYear + 5;

  for (const m of text.matchAll(GRAD_ANCHOR)) {
    const anchor = m[0];
    const start = m.index + anchor.length;
    // "graduate degree", "graduated from X" are not class years.
    if (!/^class/i.test(anchor) && NOT_A_CLASS_YEAR_TAIL.test(text.slice(start, start + 14).toLowerCase())) continue;
    const win = sentenceWindow(text, start, 110);
    let ys = yearsInWindow(win, lo, hi);
    if (ys.length === 0) continue;
    const bare = win.replace(MONTH_WORDS, ' ');
    if (ys.length >= 2 && /\b(?:between|from|through|thru|to)\b|[-–—]/.test(bare)) {
      const min = Math.min(...ys);
      const max = Math.max(...ys);
      if (max - min <= 4) ys = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    }
    const end = start + win.length;
    const phrase = text.slice(m.index, end).replace(/\s+/g, ' ').trim().toLowerCase();
    hits.push({ index: m.index, end, phrase: phrase.length > 70 ? `${phrase.slice(0, 67)}...` : phrase, years: ys });
  }

  // "2028 graduates", "2027-2028 grads"
  for (const m of text.matchAll(/(?<![\d$,.])(20\d\d)(?:\s*[-–/]\s*(20\d\d))?\s+(?:graduates?|grads?|graduating\s+class)\b/gi)) {
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < lo || b > hi || b < a) continue;
    const ys: number[] = [];
    for (let y = a; y <= b; y++) ys.push(y);
    hits.push({ index: m.index, end: m.index + m[0].length, phrase: m[0].toLowerCase(), years: ys });
  }
  return hits;
}

const STUDENT_YEAR_WORDS: { re: RegExp; cls: ClassYear }[] = [
  { re: /\b(?:first|1st)[- ]year\s+(?:students?|undergrad\w*|college)\b/gi, cls: 'freshman' },
  { re: /\b(?:second|2nd)[- ]year\s+(?:students?|undergrad\w*|college)\b/gi, cls: 'sophomore' },
  { re: /\b(?:third|3rd)[- ]year\s+(?:students?|undergrad\w*|college)\b/gi, cls: 'junior' },
  { re: /\b(?:fourth|4th|final)[- ]year\s+(?:students?|undergrad\w*|college)\b/gi, cls: 'senior' },
  { re: /\bpenultimate[- ]year\b/gi, cls: 'junior' },
];

export function extractEligibility(title: string, description: string, summerYear: number): Eligibility {
  const text = `${title}\n${description}`;
  const hits: Hit[] = [];

  for (const mention of scanClassWords(text)) {
    if (!mention.valid) continue;
    const year = mention.mode === 'rising' ? risingYear(mention.cls, summerYear) : gradYearFor(mention.cls, summerYear);
    // Show the leading modifier and trailing noun too ("rising junior", "sophomore program").
    const lead = text.slice(Math.max(0, mention.index - 20), mention.index).toLowerCase();
    const modifier = /(rising|current|currently an?|entering your|entering their)\s+$/.exec(lead)?.[0] ?? '';
    const after = text.slice(mention.end, mention.end + 20).toLowerCase();
    const suffix = /^\s+(?:program|programme|year|students?|class)\b/.exec(after)?.[0] ?? '';
    const phrase = `${modifier}${mention.word.toLowerCase()}${suffix}`.replace(/\s+/g, ' ').trim();
    hits.push({ index: mention.index - modifier.length, end: mention.end + suffix.length, phrase, years: [year] });
  }

  for (const { re, cls } of STUDENT_YEAR_WORDS) {
    for (const m of text.matchAll(re)) {
      hits.push({ index: m.index, end: m.index + m[0].length, phrase: m[0].toLowerCase(), years: [gradYearFor(cls, summerYear)] });
    }
  }

  hits.push(...scanGradYears(text, summerYear));

  const first = hits.slice().sort((a, b) => a.index - b.index)[0];
  if (!first) return { gradYears: [], phrases: [], evidence: null };

  const sorted = hits.slice().sort((a, b) => a.index - b.index);
  const gradYears = [...new Set(sorted.flatMap((h) => h.years))].sort((a, b) => a - b);
  const phrases = [...new Set(sorted.map((h) => h.phrase))];
  return { gradYears, phrases, evidence: evidenceAround(text, first.index, first.end) };
}

/** The sentence/line containing the match, trimmed to <= 160 chars. */
function evidenceAround(text: string, index: number, end: number): string {
  let s = index;
  while (s > 0) {
    const prevCh = text.charAt(s - 1);
    if (prevCh === '\n') break;
    if (/\s/.test(prevCh) && /[.!?]/.test(text.charAt(s - 2)) && /[A-Z•]/.test(text.charAt(s))) break;
    s--;
  }
  let e = end;
  while (e < text.length) {
    const ch = text.charAt(e);
    if (ch === '\n') break;
    if (/[.!?]/.test(ch) && /^[.!?](?:\s+[A-Z•]|\s*$)/.test(text.slice(e, e + 4))) {
      e++;
      break;
    }
    e++;
  }
  let from = s;
  let to = e;
  let cutStart = false;
  let cutEnd = false;
  if (to - from > 156) {
    from = Math.max(s, Math.min(index - 60, to - 156));
    to = Math.min(e, from + 156);
    cutStart = from > s;
    cutEnd = to < e;
  }
  const body = text.slice(from, to).replace(/^[\s•\-*]+/, '').replace(/\s+/g, ' ').trim();
  return `${cutStart ? '…' : ''}${body}${cutEnd ? '…' : ''}`.slice(0, 160);
}
