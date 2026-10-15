import type { Rng } from './prng.ts';

/**
 * Student-facing posting language for the demo generator. Every requirement
 * sentence contains a real alias phrase from src/core/signals.ts so the
 * classifier (and findSignals) would find the same signal ids.
 */

/** Natural phrases per signal. Each lowercased phrase is a real alias of that signal. */
export const PHRASES: Record<string, string[]> = {
  excel: ['Excel', 'Microsoft Excel', 'pivot tables'],
  powerpoint: ['PowerPoint', 'Google Slides', 'Keynote'],
  sql: ['SQL'],
  python: ['Python'],
  'r-lang': ['R programming'],
  tableau: ['Tableau'],
  'power-bi': ['Power BI'],
  salesforce: ['Salesforce'],
  hubspot: ['HubSpot'],
  'google-analytics': ['Google Analytics'],
  bloomberg: ['Bloomberg Terminal', 'Bloomberg'],
  'capital-iq': ['Capital IQ', 'FactSet', 'PitchBook'],
  sap: ['SAP', 'ERP'],
  'adobe-creative': ['Photoshop', 'Illustrator', 'Canva', 'Figma'],
  quickbooks: ['QuickBooks'],
  vba: ['VBA'],
  'financial-modeling': ['financial modeling', 'discounted cash flow', 'DCF'],
  valuation: ['valuation', 'comparable companies', 'precedent transactions'],
  'financial-analysis': ['financial analysis', 'financial statements', 'ratio analysis', 'variance analysis'],
  'accounting-principles': ['GAAP', 'financial accounting', 'journal entries', 'reconciliations', 'general ledger'],
  audit: ['audit', 'internal controls', 'SOX'],
  tax: ['tax', 'tax returns'],
  budgeting: ['budgeting', 'forecasting', 'FP&A'],
  'market-research': ['market research', 'competitive analysis', 'consumer insights', 'customer research'],
  'data-analysis': ['data analysis', 'data analytics', 'statistical analysis', 'data visualization', 'quantitative analysis'],
  'problem-solving': ['case competition', 'case interview', 'hypothesis-driven', 'structured problem solving'],
  copywriting: ['copywriting', 'content writing', 'blog posts'],
  'social-media': ['social media', 'Instagram', 'TikTok', 'content calendar', 'community management'],
  'digital-marketing': ['digital marketing', 'SEO', 'paid social', 'email marketing', 'performance marketing', 'A/B testing'],
  brand: ['brand management', 'brand strategy', 'brand marketing', 'go-to-market', 'product marketing'],
  'sales-skills': ['prospecting', 'cold calling', 'lead generation', 'pipeline management', 'business development', 'account management'],
  'customer-service': ['customer service', 'client-facing', 'customer-facing', 'retail experience'],
  'project-management': ['project management', 'project coordination', 'Agile', 'Scrum'],
  'process-improvement': ['process improvement', 'Lean manufacturing', 'Six Sigma', 'continuous improvement'],
  logistics: ['logistics', 'procurement', 'inventory', 'demand planning', 'supply planning', 'purchasing', 'strategic sourcing', 'warehouse operations'],
  recruiting: ['recruiting', 'talent acquisition', 'HRIS'],
  'real-estate-analysis': ['real estate', 'underwriting', 'ARGUS', 'property management', 'leasing'],
  investing: ['equity research', 'investment research', 'portfolio management', 'stock pitch', 'investment club', 'capital markets', 'fixed income', 'equities', 'derivatives'],
  'research-writing': ['report writing', 'written communication', 'writing skills'],
  'product-sense': ['product roadmap', 'user research', 'requirements gathering', 'user stories'],
  programming: ['programming', 'coding', 'JavaScript', 'Java', 'software development'],
  spanish: ['Spanish', 'bilingual'],
};

/** Hand-written bullets for experience and trait signals (each contains a real alias). */
const FIXED_SENTENCES: Record<string, string[]> = {
  'exp:internship': ['Prior internship experience in a related field', 'Internship experience, even a short one'],
  'exp:leadership': ['Leadership experience, such as a student organization or a team captain role', 'A record of leadership in a student organization'],
  'exp:work': ['Work experience, including a part-time job', 'Some work experience (a part-time job counts)'],
  'trait:communication': ['Strong communication skills, written and spoken', 'Clear communication skills with teammates and clients'],
  'trait:teamwork': ['A team player who enjoys collaboration', 'Teamwork and collaborative habits'],
  'trait:detail': ['Attention to detail', 'A detail-oriented approach to your work'],
};

const REQ_TEMPLATES = [
  'Working knowledge of {p}',
  'Hands-on experience with {p}',
  'Familiarity with {p}',
  'Experience with {p} through coursework, clubs or work',
  'Solid grounding in {p}',
];

const PREF_TEMPLATES = [
  '{P} experience is a plus',
  'Exposure to {p} is a plus',
  'Bonus: {p}',
  'Familiarity with {p} is a plus',
  'Interest in {p}',
];

const PROBLEM_SOLVING_REQ = [
  'Case competition or case interview experience',
  'A hypothesis-driven approach to structured problem solving',
];

function capFirst(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function reqSentence(rng: Rng, id: string): string {
  const fixed = FIXED_SENTENCES[id];
  if (fixed) return rng.pick(fixed);
  if (id === 'problem-solving') return rng.pick(PROBLEM_SOLVING_REQ);
  const phrases = PHRASES[id];
  if (!phrases) throw new Error(`no phrases for signal ${id}`);
  return rng.pick(REQ_TEMPLATES).replace('{p}', rng.pick(phrases));
}

export function prefSentence(rng: Rng, id: string): string {
  const fixed = FIXED_SENTENCES[id];
  if (fixed) return rng.pick(fixed);
  const phrases = PHRASES[id];
  if (!phrases) throw new Error(`no phrases for signal ${id}`);
  const p = rng.pick(phrases);
  return rng.pick(PREF_TEMPLATES).replace('{p}', p).replace('{P}', capFirst(p));
}

const MAJOR_DISPLAY: Record<string, string[]> = {
  'major:finance': ['Finance'],
  'major:accounting': ['Accounting'],
  'major:economics': ['Economics'],
  'major:business': ['Business Administration', 'Business'],
  'major:marketing': ['Marketing'],
  'major:supply-chain': ['Supply Chain', 'Operations Management'],
  'major:information-systems': ['Information Systems', 'Business Analytics'],
  'major:stem': ['Engineering', 'Mathematics', 'Computer Science', 'Statistics'],
  'major:communications': ['Communications', 'Journalism', 'Advertising'],
  'major:hr': ['Human Resources'],
  'major:real-estate': ['Real Estate'],
};

export function majorList(rng: Rng, majors: string[]): string {
  const names = majors.map((m) => rng.pick(MAJOR_DISPLAY[m] ?? ['Business']));
  const uniq = [...new Set(names)];
  if (uniq.length === 1) return uniq[0] as string;
  return `${uniq.slice(0, -1).join(', ')} or ${uniq[uniq.length - 1] as string}`;
}

// ---------- eligibility ----------

export type EligKind = 'none' | 'junior' | 'soph' | 'fresh' | 'multi';

export interface EligPick {
  kind: EligKind;
  gradYears: number[];
  phrases: string[];
  /** The bullet sentence (also the evidence); null when the posting says nothing. */
  sentence: string;
}

const ELIG: Record<EligKind, { years: number[]; items: { s: string; p: string[] }[] }> = {
  none: {
    years: [],
    items: [
      { s: 'Currently enrolled in an undergraduate degree program', p: [] },
      { s: "Enrolled in a bachelor's degree program with a strong academic record", p: [] },
      { s: 'Currently pursuing an undergraduate degree and able to work full time for the whole program', p: [] },
    ],
  },
  junior: {
    years: [2028],
    items: [
      { s: 'Open to rising seniors graduating between December 2027 and June 2028', p: ['rising senior', 'graduating between december 2027 and june 2028'] },
      { s: 'Students in the Class of 2028 (rising seniors)', p: ['class of 2028', 'rising senior'] },
      { s: 'You are a rising senior with an expected graduation date in 2028', p: ['rising senior', 'graduation date in 2028'] },
      { s: 'Currently a junior, graduating in 2028', p: ['junior', 'graduating in 2028'] },
    ],
  },
  soph: {
    years: [2029],
    items: [
      { s: 'This is a sophomore program for rising juniors graduating in 2029', p: ['sophomore program', 'rising junior', 'graduating in 2029'] },
      { s: 'Open to rising juniors (Class of 2029)', p: ['rising junior', 'class of 2029'] },
      { s: 'Sophomores graduating between December 2028 and June 2029 are encouraged to apply to this sophomore program', p: ['sophomore program', 'graduating between december 2028 and june 2029'] },
    ],
  },
  fresh: {
    years: [2030],
    items: [
      { s: 'First-year students graduating in 2030 are welcome', p: ['first-year', 'graduating in 2030'] },
      { s: 'Open to rising sophomores (Class of 2030) who have finished their first year', p: ['rising sophomore', 'class of 2030', 'first year'] },
      { s: 'Designed for freshman and first-year students graduating in 2030', p: ['freshman', 'first-year', 'graduating in 2030'] },
    ],
  },
  multi: {
    years: [2028, 2029],
    items: [
      { s: 'Open to rising juniors and rising seniors graduating in 2028 or 2029', p: ['rising junior', 'rising senior', 'graduating in 2028 or 2029'] },
      { s: 'Students graduating in 2028 or 2029 are eligible', p: ['students graduating in 2028 or 2029'] },
      { s: 'Open to students in the Class of 2028 or Class of 2029', p: ['class of 2028', 'class of 2029'] },
    ],
  },
};

export function pickEligibility(rng: Rng, kind: EligKind): EligPick {
  const e = ELIG[kind];
  const item = rng.pick(e.items);
  return { kind, gradYears: e.years.slice(), phrases: item.p.slice(), sentence: item.s };
}

// ---------- description ----------

const INTRO_TEMPLATES = [
  '{co} is hiring {role} interns for summer 2027 in {cities}. For {weeks} weeks you will work with the {team} team on real projects from the first week.',
  'Spend {weeks} weeks this summer with {co} in {cities}. As part of the {team} team you will own a piece of live work and present it at the end of the program.',
  'Join the {team} team at {co} for a {weeks}-week summer internship based in {cities}. You will be paired with a mentor and a recent intern as a buddy.',
  'The {team} team at {co} is looking for summer 2027 interns. The internship runs {weeks} weeks in {cities} and ends with a final presentation to the team.',
  'This {weeks}-week summer 2027 internship sits with the {team} team at {co}, in {cities}. You will work on real deliverables, not make-work.',
  '{co} runs a {weeks}-week summer internship in {cities}. On the {team} team you will learn the {role} work from the inside and take on projects that ship.',
];

const CLOSERS = [
  'We review applications on a rolling basis, so apply early.',
  'The internship starts in early June and runs through mid-August.',
  'Every intern gets a mentor and a structured onboarding week.',
  'No cover letter needed. Your resume and a few short questions are enough.',
  'We are an equal opportunity employer and welcome applicants from every background.',
  'Housing support is available for interns relocating for the summer.',
];

const EXTRA_BULLETS = [
  'Authorization to work in the United States for the full internship term',
  'Available to work full time for the whole program, early June through mid-August',
  'Able to work on site with your team at least three days a week',
];

const ABOUT_TEAM = [
  'Interns sit with their team, join weekly check-ins and get feedback from their manager every two weeks.',
  'Past interns have gone on to full-time roles, and many return to speak with the next class.',
  'You will also join intern-only events, from speaker sessions to office tours.',
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return `${MONTHS[m - 1] as string} ${d}, ${y}`;
}

export function listText(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1] as string}`;
}

export interface DescInput {
  company: string;
  blurb: string;
  roleLabel: string;
  team: string;
  citiesText: string;
  weeks: number;
  responsibilities: string[];
  elig: EligPick;
  /** Rendered major list, or null when the text does not name majors. */
  majorsText: string | null;
  minGpa: number | null;
  required: string[];
  preferred: string[];
  /** Pay sentence to embed (description-sourced pay), or null. */
  paySentence: string | null;
  /** "Apply by ..." sentence, or null. */
  deadlineSentence: string | null;
}

export const DESC_MIN = 600;
export const DESC_MAX = 1600;

export function buildDescription(rng: Rng, d: DescInput): string {
  const intro = rng
    .pick(INTRO_TEMPLATES)
    .replaceAll('{co}', d.company)
    .replaceAll('{role}', d.roleLabel)
    .replaceAll('{team}', d.team)
    .replaceAll('{cities}', d.citiesText)
    .replaceAll('{weeks}', String(d.weeks));
  const about = `${d.company} ${d.blurb}`;
  const resp = rng.shuffle(d.responsibilities);
  const closers = rng.shuffle(CLOSERS);
  const extra = rng.chance(0.25) ? rng.pick(EXTRA_BULLETS) : null;
  const majorsTpl = rng.pick([
    'Majors we see most: {m}, or a related field',
    'Pursuing a degree in {m}, or a related field',
    'Studying {m}, or something close to it',
  ]);
  const aboutTeam = rng.pick(ABOUT_TEAM);

  const reqBullets = d.required.map((id) => reqSentence(rng, id));
  const prefBullets = d.preferred.map((id) => prefSentence(rng, id));

  const build = (nResp: number, nClose: number, withExtra: boolean, withAboutTeam: boolean): string => {
    const quals: string[] = [d.elig.sentence];
    if (d.majorsText) quals.push(majorsTpl.replace('{m}', d.majorsText));
    if (d.minGpa !== null) quals.push(`A ${d.minGpa.toFixed(1)} GPA or higher`);
    quals.push(...reqBullets);
    if (extra && withExtra) quals.push(extra);

    const blocks: string[] = [];
    blocks.push(`${intro} ${about}`);
    blocks.push(`What you'll do\n${resp.slice(0, nResp).map((r) => `- ${r}`).join('\n')}`);
    blocks.push(`Qualifications\n${quals.map((q) => `- ${q}`).join('\n')}`);
    if (prefBullets.length > 0) blocks.push(`Preferred\n${prefBullets.map((q) => `- ${q}`).join('\n')}`);

    const tail: string[] = [];
    if (d.paySentence) tail.push(d.paySentence);
    if (d.deadlineSentence) tail.push(d.deadlineSentence);
    if (withAboutTeam) tail.push(aboutTeam);
    tail.push(...closers.slice(0, nClose));
    tail.push('Fictional demo posting.');
    blocks.push(tail.join(' '));
    return blocks.join('\n\n');
  };

  // Walk from the fullest version down until it fits, then up if it is too short.
  const attempts: [number, number, boolean, boolean][] = [
    [3, 1, true, false],
    [3, 0, true, false],
    [3, 0, false, false],
    [2, 0, false, false],
  ];
  let text = build(3, 1, true, false);
  for (const a of attempts) {
    text = build(...a);
    if (text.length <= DESC_MAX) break;
  }
  const grow: [number, number, boolean, boolean][] = [
    [4, 2, true, false],
    [4, 3, true, true],
    [5, 3, true, true],
    [6, 4, true, true],
  ];
  for (const g of grow) {
    if (text.length >= DESC_MIN) break;
    text = build(...g);
  }
  return text;
}
