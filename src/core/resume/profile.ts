/**
 * Resume text -> structured Profile. Pure TypeScript, no DOM: the same code runs in
 * the browser (after extract.ts) and in Node tests. Best-effort by design: every field
 * is null / empty when the resume does not clearly say, and the student confirms the
 * chips on the next onboarding screen.
 */
import { classYearFor, currentSpring } from '../cycle.ts';
import { findSignals } from '../signals.ts';
import type { ClassYear, Profile } from '../types.ts';

// ---------- small helpers ----------

const MONTH =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const SEASON = '(?:spring|summer|fall|autumn|winter)';
const DATE_SRC = `(?:(?:${MONTH}\\.?,?\\s+|${SEASON}\\s+|\\d{1,2}[/-])?(?:19|20)\\d{2})`;
const RANGE_SRC = `${DATE_SRC}\\s*(?:-|\\u2013|\\u2014|to)\\s*(?:${DATE_SRC}|present|current|now|ongoing)`;
/** A trailing date range or single date, with its separator. */
const TRAILING_DATE_RE = new RegExp(`\\s*(?:[|,;\\-\\u2013\\u2014]\\s*)?(?:${RANGE_SRC}|${DATE_SRC})\\s*$`, 'i');

const BULLET_RE = /^\s*(?:[-*\u2022\u00B7\u25AA\u25CF\u2013\u2014>]|\d+[.)])\s+/;

const SECTION_RE =
  /^(?:education|academics?|academic (?:background|history)|(?:relevant |professional |work |internship |related |leadership )?experience|employment(?: history)?|leadership|activities|involvement|extracurriculars?|(?:technical |core |additional )?skills|projects?|honors|awards|certifications?|summary|objective|profile|interests|volunteer(?:ing)?|publications|languages)(?:\s*(?:&|and|\/|,)\s*[a-z]+(?:\s[a-z]+)?)?$/i;

type SectionKey = 'top' | 'education' | 'experience' | 'activities' | 'projects' | 'skills' | 'other';

function sectionKeyOf(header: string): SectionKey {
  const h = header.toLowerCase();
  if (/^(?:education|academ)/.test(h)) return 'education';
  if (/^(?:leadership|activities|involvement|extracurricular|volunteer)/.test(h)) return 'activities';
  if (/experience|^employment|^work/.test(h)) return 'experience';
  if (/^project/.test(h)) return 'projects';
  if (/skills|^interests|^languages/.test(h)) return 'skills';
  return 'other';
}

function isHeader(line: string): boolean {
  const t = line.trim().replace(/[:\u2013\u2014-]+$/, '').trim();
  return t.length > 0 && t.length <= 48 && !/[@\d]/.test(t) && SECTION_RE.test(t);
}

interface Parsed {
  /** All non-empty lines, trimmed. */
  lines: string[];
  sections: Record<SectionKey, string[]>;
  hasSections: boolean;
}

function splitSections(text: string): Parsed {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/g, '').trim())
    .filter((l) => l !== '');
  const sections: Record<SectionKey, string[]> = { top: [], education: [], experience: [], activities: [], projects: [], skills: [], other: [] };
  let current: SectionKey = 'top';
  let hasSections = false;
  for (const line of lines) {
    if (isHeader(line)) {
      current = sectionKeyOf(line);
      hasSections = true;
      continue;
    }
    sections[current].push(line);
  }
  return { lines, sections, hasSections };
}

const titleCase = (s: string): string =>
  s.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase());

// ---------- name, email ----------

const NOT_A_NAME = /\b(?:resume|curriculum|vitae|cv|university|college|institute|school|education|experience|skills|objective|summary|intern|internship|present|gpa|expected|coursework|references?)\b/i;

function parseName(lines: string[]): string | null {
  for (const raw of lines.slice(0, 8)) {
    const line = raw.split(/\s*[|\u2022\u00B7]\s*/)[0]?.replace(/[,;].*$/, '').trim() ?? '';
    if (!line || /[@\d:/]/.test(line) || NOT_A_NAME.test(line) || isHeader(line)) continue;
    const toks = line.split(/\s+/);
    if (toks.length < 2 || toks.length > 4) continue;
    if (!toks.every((t) => /^[A-Z][A-Za-z.'’-]*$/.test(t))) continue;
    return line === line.toUpperCase() ? titleCase(line) : line;
  }
  return null;
}

function parseEmail(text: string): string | null {
  const m = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/.exec(text);
  return m ? m[0].toLowerCase() : null;
}

// ---------- school ----------

const SCHOOL_RE =
  /(?:(?:The )?University of [A-Z][A-Za-z&.'’-]*(?: [A-Z][A-Za-z&.'’-]*){0,2}|[A-Z][A-Za-z&.'’-]*(?: [A-Z&][A-Za-z&.'’-]*){0,4} (?:University|College|Institute of Technology|Institute|Polytechnic Institute|Polytechnic))/;
const SCHOOL_OF_RE = /(?:[A-Z][A-Za-z&.'’-]*(?: [A-Z][A-Za-z&.'’-]*){0,2} )?School of [A-Z][A-Za-z&.'’-]*(?: [A-Z][A-Za-z&.'’-]*){0,3}/;
const SCHOOL_WORD_RE = /\b(?:university|college|institute|polytechnic|school of)\b/i;
const HIGH_SCHOOL_RE = /\bhigh school\b|\bacademy\b|\bprep(?:aratory)?\b/i;

function schoolFromLine(line: string): string | null {
  // "GEORGIA LAKES UNIVERSITY": match on a title-cased copy of all-caps lines
  const letters = line.replace(/[^A-Za-z]/g, '');
  const upper = letters.replace(/[^A-Z]/g, '').length;
  const src = letters.length > 4 && upper / letters.length >= 0.7 ? titleCase(line) : line;
  const m = SCHOOL_RE.exec(src) ?? SCHOOL_OF_RE.exec(src);
  return m ? m[0].trim() : null;
}

function parseSchool(p: Parsed): string | null {
  const pools = p.sections.education.length > 0 ? [p.sections.education, p.lines] : [p.lines];
  for (const pool of pools) {
    for (const line of pool) {
      if (BULLET_RE.test(line) || HIGH_SCHOOL_RE.test(line) || !SCHOOL_WORD_RE.test(line)) continue;
      const hit = schoolFromLine(line);
      if (hit) return hit;
      return line.replace(TRAILING_DATE_RE, '').replace(/,\s*[A-Z][A-Za-z. ]+,\s*[A-Z]{2}$/, '').trim() || null;
    }
  }
  return null;
}

// ---------- GPA ----------

function parseGpa(text: string): number | null {
  const candidates: { value: number; weight: number }[] = [];
  const patterns = [
    /\b(cumulative|overall|major|term)?\s*GPA\b[^0-9\n]{0,24}?(\d\.\d{1,3}|\d(?![\d./]))(?:\s*\/\s*(\d{1,2}(?:\.\d{1,2})?))?/gi,
    /\b(\d\.\d{1,3})\s*(?:\/\s*(\d{1,2}(?:\.\d{1,2})?))?\s*(cumulative |overall )?GPA\b/gi,
  ];
  patterns.forEach((re, i) => {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const qualifier = (i === 0 ? m[1] : m[3])?.toLowerCase().trim() ?? '';
      const value = Number(i === 0 ? m[2] : m[1]);
      const denomRaw = i === 0 ? m[3] : m[2];
      const denom = denomRaw ? Number(denomRaw) : null;
      let v = value;
      if (denom !== null && denom > 0 && denom !== 4) v = (value / denom) * 4;
      else if (denom === null && value > 4) continue;
      if (!(v > 0 && v <= 4)) continue;
      candidates.push({ value: Math.round(v * 100) / 100, weight: qualifier === 'major' || qualifier === 'term' ? 0 : qualifier ? 2 : 1 });
    }
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.weight - a.weight);
  return candidates[0]?.value ?? null;
}

// ---------- graduation year ----------

const KEYWORD_YEAR_RE = new RegExp(
  `\\b(?:expected|anticipated|exp\\.|graduat\\w*|grad\\.|degree expected|class of)\\b[^\\n]{0,40}?\\b(20\\d{2})\\b`,
  'gi',
);
const CLASS_OF_RE = /\bclass of\s*'?((?:20)?\d{2})\b/gi;
const RANGE_END_RE = new RegExp(`${DATE_SRC}\\s*(?:-|\\u2013|\\u2014|to)\\s*(${DATE_SRC})`, 'gi');

function fullYear(raw: string): number | null {
  if (raw.length === 2) return 2000 + Number(raw);
  const n = Number(raw);
  return n >= 1990 && n <= 2099 ? n : null;
}

function parseGradYear(p: Parsed, nowIso: string): number | null {
  const nowYear = new Date(nowIso).getUTCFullYear();
  const ok = (y: number | null): y is number => y !== null && y >= nowYear - 1 && y <= nowYear + 8;
  const pool = p.sections.education.length > 0 ? p.sections.education : p.lines.filter((l) => /\b(?:university|college|institute|bachelor|b\.?\s?[sa]\.?|expected|anticipated|class of|graduat)/i.test(l));
  const lines = pool.filter((l) => !HIGH_SCHOOL_RE.test(l) && !/coursework/i.test(l));

  // 1. explicit words ("Expected May 2028", "Class of 2029", "Graduation: 2027")
  const explicit: number[] = [];
  for (const line of lines) {
    for (const re of [KEYWORD_YEAR_RE, CLASS_OF_RE]) {
      const r = new RegExp(re.source, re.flags);
      let m: RegExpExecArray | null;
      while ((m = r.exec(line)) !== null) {
        const y = fullYear(m[1] ?? '');
        if (ok(y)) explicit.push(y);
      }
    }
  }
  if (explicit.length > 0) return Math.max(...explicit);

  // 2. the end of a date range on a degree line ("Aug 2025 - May 2029")
  const ends: number[] = [];
  for (const line of lines) {
    const r = new RegExp(RANGE_END_RE.source, RANGE_END_RE.flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(line)) !== null) {
      const y = fullYear(/(?:19|20)\d{2}/.exec(m[1] ?? '')?.[0] ?? '');
      if (ok(y)) ends.push(y);
    }
  }
  if (ends.length > 0) return Math.max(...ends);

  // 3. a lone "May 2028" on a degree line
  for (const line of lines) {
    if (!/\b(?:bachelor|b\.?\s?[sa]\.?|bba|degree|major|b\.?s\.?b\.?a)\b/i.test(line)) continue;
    const m = /(?:19|20)\d{2}/.exec(line.replace(/\d+\.\d+\s*\/?\s*\d*\.?\d*/g, ''));
    const y = fullYear(m?.[0] ?? '');
    if (ok(y)) return y;
  }
  return null;
}

/** Class year during the academic year `nowIso` falls in, from a graduation year. */
export function classYearFromGrad(gradYear: number | null, nowIso: string): ClassYear | null {
  if (gradYear === null || !Number.isFinite(gradYear)) return null;
  return classYearFor(gradYear, currentSpring(nowIso));
}

// ---------- majors ----------

const DEGREE_LINE_RE =
  /\b(?:b\.?\s?s\.?|b\.?\s?a\.?|b\.?\s?b\.?\s?a\.?|b\.?\s?s\.?\s?b\.?\s?a\.?|bachelor(?:'s|s)?|major(?:ing)?|minor(?:ing)?|concentration|double major|dual degree|degree|candidate for|m\.?\s?b\.?\s?a\.?|master(?:'s|s)?)\b/i;

/** "Supply Chain Management" should read as supply chain, not as a business major. */
const COMPOUND_MANAGEMENT_RE =
  /\b(supply chain|operations|project|human resources|risk|financial|information systems|marketing|product|brand|hospitality|sports|construction|property|real estate|business) management\b/gi;

const SCHOOL_PHRASE_RE =
  /\b(?:[A-Z][\w&'’-]*\s+){0,4}(?:University|College|Institute|Polytechnic)\b(?:\s+of\s+[A-Z][\w&'’-]*(?:\s[A-Z][\w&'’-]*){0,3})?|\b(?:School|College|Department|Faculty|Division) of (?:Business|Management|Engineering|Communications?|Economics|Arts|Sciences?)\b|\b(?:Business|Management|Engineering|Communications?) School\b/g;

const GPA_PHRASE_RE = /\b\d\.\d{1,3}\s*(?:\/\s*\d{1,2}(?:\.\d+)?)?\s*GPA\b|\bGPA\b[^\n,;|]*/gi;

function parseMajors(p: Parsed): string[] {
  const eduLines = p.sections.education.length > 0 ? p.sections.education : p.lines.filter((l) => DEGREE_LINE_RE.test(l));
  let degreeLines = eduLines.filter((l) => DEGREE_LINE_RE.test(l) && !/coursework/i.test(l));
  if (degreeLines.length === 0) {
    // "Economics | Class of 2029": a short education line that is not a school, GPA or coursework line
    degreeLines = eduLines.filter((l) => l.length <= 70 && !SCHOOL_WORD_RE.test(l) && !/coursework|\bgpa\b|honors|dean/i.test(l));
  }
  const text = degreeLines
    .map((l) => l.replace(SCHOOL_PHRASE_RE, ' ').replace(GPA_PHRASE_RE, ' ').replace(COMPOUND_MANAGEMENT_RE, '$1'))
    .join('\n');
  return findSignals(text, ['major']);
}

// ---------- coursework ----------

function splitList(s: string): string[] {
  return s
    .split(/[,;\u2022|]|\s{3,}/)
    .map((x) => x.replace(/^\s*(?:and|&)\s+/i, '').replace(/[.\s]+$/g, '').trim())
    .filter((x) => x.length > 1 && x.length <= 60);
}

function parseCoursework(p: Parsed): string[] {
  const out: string[] = [];
  const lines = p.lines;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const m = /^(?:relevant |key |selected |related |major )?(?:course ?work|courses)\s*[:\u2013\u2014-]?\s*(.*)$/i.exec(line);
    if (!m) continue;
    let rest = m[1] ?? '';
    // continuation lines: the list wrapped onto the next line(s)
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j] ?? '';
      const wrapped = rest === '' || /[,;]\s*$/.test(rest);
      if (!wrapped || isHeader(next) || BULLET_RE.test(next) || /^[A-Za-z ]{2,30}:/.test(next)) break;
      rest += ` ${next}`;
      j++;
    }
    out.push(...splitList(rest));
  }
  return [...new Set(out)].slice(0, 30);
}

// ---------- experience ----------

const TITLE_RE =
  /\b(?:interns?|internship|analyst|associate|assistant|coordinator|manager|director|president|vice president|vp|treasurer|secretary|captain|founder|co-founder|chair(?:person|man|woman)?|member|lead|leader|representative|ambassador|counselor|tutor|barista|cashier|server|clerk|volunteer|researcher|consultant|specialist|engineer|developer|designer|editor|writer|officer|fellow|trainee|apprentice|host|lifeguard|guide|mentor|instructor|co-?op|extern|executive|head|supervisor|teaching assistant|ta)\b/i;

function stripDates(s: string): string {
  let prev: string;
  let cur = s;
  do {
    prev = cur;
    cur = cur.replace(TRAILING_DATE_RE, '').replace(/\s*[|]\s*$/, '');
  } while (cur !== prev);
  return cur.trim();
}

function parseExperienceLine(line: string): { title: string; org: string | null } | null {
  if (BULLET_RE.test(line) || line.length > 120) return null;
  const hasDate = new RegExp(`(?:${RANGE_SRC}|${DATE_SRC})\\s*$`, 'i').test(line);
  if (!hasDate && !TITLE_RE.test(line)) return null;
  if (/^[A-Za-z ]{2,30}:/.test(line) && !hasDate) return null;
  const core = stripDates(line).replace(/\((?:part|full)[- ]time[^)]*\)/gi, '').trim();
  const segs = core
    .split(/\s+[|\u2013\u2014-]\s+|\s{2,}|\t|,\s+|\|/)
    .map((s) => s.trim())
    .filter((s) => s !== '' && !/^[A-Z]{2}$/.test(s));
  if (segs.length === 0) return null;
  const titleIdx = segs.findIndex((s) => TITLE_RE.test(s));
  if (titleIdx < 0) return null;
  const title = segs[titleIdx] ?? '';
  const org = segs.find((_s, i) => i !== titleIdx) ?? null;
  if (title.length < 3) return null;
  return { title: title.replace(/^of\s+/i, ''), org };
}

function parseExperience(p: Parsed): { title: string; org: string | null }[] {
  const pool = p.hasSections ? [...p.sections.experience, ...p.sections.activities, ...p.sections.projects] : p.lines.slice(2);
  const out: { title: string; org: string | null }[] = [];
  const seen = new Set<string>();
  for (const line of pool) {
    const e = parseExperienceLine(line);
    if (!e) continue;
    const key = `${e.title}|${e.org ?? ''}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= 8) break;
  }
  return out;
}

// ---------- skills ----------

const LEADERSHIP_RE = /\b(?:president|vice president|vp|founder|co-founder|captain|chair(?:person|man|woman)?|treasurer|led|leader|head of)\b/i;

function parseSkills(text: string, experience: { title: string; org: string | null }[]): string[] {
  const ids = findSignals(text).filter((id) => !id.startsWith('major:'));
  const set = new Set(ids);
  if (experience.some((e) => /\bintern(?:ship)?s?\b/i.test(e.title))) set.add('exp:internship');
  if (LEADERSHIP_RE.test(text)) set.add('exp:leadership');
  return [...set];
}

// ---------- entry point ----------

/**
 * Parse resume text into a Profile.
 * `nowIso` anchors "graduation year is plausible" (a window around the current academic year).
 */
export function parseProfile(text: string, nowIso: string): Profile {
  const p = splitSections(text);
  const experience = parseExperience(p);
  return {
    name: parseName(p.lines),
    email: parseEmail(text),
    school: parseSchool(p),
    majors: parseMajors(p),
    gpa: parseGpa(text),
    gradYear: parseGradYear(p, nowIso),
    skills: parseSkills(text, experience),
    coursework: parseCoursework(p),
    experience,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  };
}
