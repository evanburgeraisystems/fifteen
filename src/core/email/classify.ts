/**
 * Email stage classification. Pure rules over subject + body + sender:
 * forwarded recruiting email -> { kind, company guess, role guess, evidence }.
 *
 * Design notes
 *  - Every kind is a list of weighted phrase rules. A kind's score is its best
 *    rule plus a small bonus per extra rule that fired.
 *  - Conditional sentences ("if selected, we will invite you to interview")
 *    are removed before scoring, so confirmation emails that promise future
 *    steps are not mistaken for those steps.
 *  - Later stages beat "thank you for applying" (which appears in most of
 *    them), and rejection beats everything else when its language is strong.
 *  - Newsletters, event invites and job alerts are penalised, so "we offer a
 *    great culture" or "first round interview tips" stay in `other`.
 */
import type { EmailClassification, EmailKind, InboundEmail } from '../types.ts';

// ---------- rules ----------

interface Rule {
  re: RegExp;
  weight: number;
  /** Extra regex that must also match somewhere in the scanned text. */
  also?: RegExp;
}

type ScoredKind = Exclude<EmailKind, 'other'>;

const RULES: Record<ScoredKind, Rule[]> = {
  rejection: [
    { re: /\bnot (?:be )?(?:moving|going|proceeding|progressing|advancing) (?:forward|ahead|further)\b/i, weight: 0.92 },
    { re: /\b(?:won't|will not|cannot|can't|unable to|not able to|not going to) (?:be )?(?:able to )?(?:move|moving|proceed|proceeding|advance|advancing|progress|continue|continuing) (?:forward|further|with)\b/i, weight: 0.92 },
    { re: /\b(?:decided|chosen|elected|opted) to (?:pursue|move forward with|proceed with|go with|continue with|move ahead with) (?:other|another|different)\b/i, weight: 0.93 },
    { re: /\bdecided not to (?:move|proceed|continue|advance|pursue|extend)\b/i, weight: 0.9 },
    { re: /\bwill not be (?:proceeding|moving|advancing|continuing|considering|pursuing)\b/i, weight: 0.93 },
    { re: /\b(?:position|role|internship|opening|requisition) (?:has been|was|is now|has now been) (?:filled|closed|cancell?ed|withdrawn)\b/i, weight: 0.9 },
    { re: /\bno longer (?:accepting|considering|reviewing) (?:applications|candidates)\b/i, weight: 0.85 },
    { re: /\b(?:regret|sorry) to (?:inform|tell|let)\b/i, weight: 0.9 },
    { re: /\b(?:unable|not able|cannot|can't|won't|will not) (?:to )?(?:extend|make|offer) (?:you )?(?:an |a )?(?:offer|invitation)\b/i, weight: 0.92 },
    { re: /\bnot (?:been )?(?:selected|chosen|shortlisted)\b/i, weight: 0.88 },
    { re: /\bother candidates\b[^.!?\n]{0,80}\b(?:closely|better|more)\b/i, weight: 0.85 },
    { re: /\bthank you for your interest\b[^.!?\n]{0,200}\b(?:however|but|unfortunately)\b/i, weight: 0.85 },
    { re: /\b(?:application|candidacy) (?:was |has been |is )?(?:not successful|unsuccessful)\b/i, weight: 0.9 },
    { re: /\bwe will keep your (?:resume|application|information) on file\b/i, weight: 0.5 },
  ],
  offer: [
    { re: /\b(?:pleased|excited|delighted|thrilled|happy|proud) to (?:offer|extend)\b/i, weight: 0.95 },
    { re: /\bextend(?:ing)? (?:to )?(?:you )?(?:an |the |a )?(?:formal |official |verbal )?(?:offer|invitation to join)\b/i, weight: 0.93 },
    { re: /\boffer of (?:employment|an? internship)\b/i, weight: 0.93 },
    { re: /\boffer letter\b/i, weight: 0.9 },
    { re: /\boffer you (?:the|a|an) (?:position|role|internship|opportunity|job|summer|analyst|associate|intern)/i, weight: 0.93 },
    { re: /\bcongratulations\b[^.!?]{0,160}\boffer\b/i, weight: 0.93 },
    { re: /\baccept (?:this|the|your|our) (?:offer|position|internship)\b/i, weight: 0.88 },
    { re: /\b(?:job|internship|full[- ]time) offer\b/i, weight: 0.8 },
    { re: /\bcompensation (?:package|details)\b[^.!?\n]{0,120}\bstart date\b/i, weight: 0.7 },
  ],
  assessment: [
    { re: /\bhire ?vue\b/i, weight: 0.9 },
    { re: /\b(?:codility|hackerrank|codesignal|pymetrics|harver|criteria corp|vervoe|testgorilla|revelian|wonderlic|cappfinity|plum\.io)\b/i, weight: 0.93 },
    { re: /\bSHL\b/, weight: 0.88 },
    { re: /\b(?:numerical|verbal|logical|inductive|deductive|situational judge?ment) (?:reasoning |judge?ment )?(?:test|assessment|questionnaire)s?\b/i, weight: 0.85 },
    { re: /\bonline assessments?\b/i, weight: 0.92 },
    { re: /\bgame[- ]based assessments?\b/i, weight: 0.94 },
    { re: /\bcomplete (?:the|this|your|a|an|our) (?:following |online |pre-?employment |digital |skills? |coding |next |first )?(?:assessment|test|challenge|exercise|questionnaire)\b/i, weight: 0.9 },
    { re: /\b(?:assessment|test) (?:link|invitation|invite|deadline)\b/i, weight: 0.85 },
    { re: /\b(?:one[- ]way|pre[- ]?recorded|on[- ]demand|asynchronous|recorded|digital) (?:video )?interview\b/i, weight: 0.9 },
    { re: /\bvideo interview\b/i, weight: 0.88, also: /\b(?:record(?:ed|ing|s)?|one[- ]way|on[- ]demand|at your convenience|anytime|webcam|no (?:live )?interviewer)\b/i },
    { re: /\b(?:coding|technical|skills|case study|written) (?:challenge|assessment|test|exercise)\b/i, weight: 0.8 },
    { re: /\bassessments?\b/i, weight: 0.5 },
  ],
  interview: [
    { re: /\b(?:schedule|scheduling|set up|setting up|arrange|arranging|book) (?:an?|your|the|a) (?:\w+[- ]?){0,2}interview\b/i, weight: 0.9 },
    { re: /\binvit\w* you (?:to|for) (?:an? |the |our |your )?(?:(?:virtual|onsite|on-site|final|first[- ]round|second[- ]round|zoom|video|phone|in-person|super ?day)[ -]?){0,2}(?:interview|super ?day)/i, weight: 0.93 },
    { re: /\binvit\w* you to interview\b/i, weight: 0.93 },
    { re: /\binterview (?:invitation|invite|request|confirmation|schedule)\b/i, weight: 0.9 },
    { re: /\bwould like to (?:interview|invite you|speak with you|chat with you|meet with you|talk with you)\b/i, weight: 0.82 },
    { re: /\bsuper ?day\b/i, weight: 0.82 },
    { re: /\bfirst[- ]round (?:interview|call|conversation)\b/i, weight: 0.9 },
    { re: /\b(?:second|final|next)[- ]round (?:interview|call|conversation)\b/i, weight: 0.9 },
    { re: /\bfirst[- ]round\b/i, weight: 0.6 },
    { re: /\bphone (?:screen(?:ing)?|interview)\b/i, weight: 0.88 },
    { re: /\b(?:initial|introductory|intro) (?:call|conversation|chat|screen)\b/i, weight: 0.8 },
    { re: /\byour availability\b[^.!?\n]{0,80}\b(?:call|chat|conversation|interview|meeting|time)/i, weight: 0.82 },
    { re: /\bavailability for (?:a|an|the) (?:call|chat|conversation|interview|meeting)\b/i, weight: 0.85 },
    { re: /\b(?:calendly|goodtime|select a time|pick a time|choose a time|book a time)\b/i, weight: 0.72 },
    { re: /\b(?:schedule|set up) (?:a|an) (?:call|chat|conversation|meeting)\b/i, weight: 0.65 },
    { re: /\binterview\b/i, weight: 0.5 },
  ],
  'applied-confirmation': [
    { re: /\bthank(?:s| you) for (?:applying|submitting your application|your application)\b/i, weight: 0.88 },
    { re: /\b(?:we(?:'ve| have)?|has) received your application\b/i, weight: 0.92 },
    { re: /\bapplication (?:has been |was |is )?(?:received|submitted|confirmed)\b/i, weight: 0.86 },
    { re: /\byour application (?:has been |was )?(?:sent|submitted|received)\b/i, weight: 0.9 },
    { re: /\bsuccessfully (?:submitted|applied)\b/i, weight: 0.9 },
    { re: /\bapplication (?:confirmation|receipt)\b/i, weight: 0.82 },
    { re: /\byou(?:'ve| have) (?:successfully )?applied\b/i, weight: 0.78 },
    { re: /\bthank(?:s| you) for your interest in\b/i, weight: 0.62 },
    { re: /\b(?:reviewing|review|reviewed) your application\b/i, weight: 0.6 },
    { re: /\bwe(?:'ll| will) be in touch\b/i, weight: 0.3 },
  ],
};

/** Priority for ties: earlier wins. */
const PRIORITY: ScoredKind[] = ['rejection', 'offer', 'assessment', 'interview', 'applied-confirmation'];

const MIN_SCORE = 0.6;

// ---------- context detectors ----------

/** Sentences that only promise something conditional ("if selected, we will invite you..."). */
const HEDGE_RE =
  /\b(?:if|should|in the event|in case|once)\b[^.!?\n]{0,90}?\b(?:selected|chosen|shortlisted|qualif\w*|match\w*|a (?:good |strong )?fit|suitable|move forward|moving forward|advance|proceed)\b/i;

/** Promises about what may happen to some candidates. */
const HEDGE2_RE =
  /\b(?:may|might|could)\s+(?:also\s+)?(?:be\s+)?(?:asked|invited|required|contacted|scheduled|need)\b|\b(?:candidates|applicants) (?:who|that|selected|chosen)\b|\bselected (?:candidates|applicants)\b/i;

/** Weak rejection signal. */
const UNFORTUNATELY_RE = /\bunfortunately\b/i;
const REJECTION_CONTEXT_RE =
  /\b(?:your (?:application|candidacy)|candidacy|consider(?:ed|ation)|pursue|not (?:be )?able to (?:move|proceed|offer|invite|extend|continue))\b/i;

const BULK_RE =
  /\b(?:newsletter|weekly digest|daily digest|job alerts?|new jobs? (?:for you|matching|in|posted)|jobs? you may like|recommended jobs?|jobs? (?:similar|picked)|view (?:this )?(?:email )?in (?:your )?browser|webinar|info session|information session|career fair|virtual event|register now|rsvp|coffee chat|tips (?:for|to|on)|how to (?:ace|negotiate|prepare|land))\b/i;

const ACCOUNT_RE =
  /\b(?:reset (?:your )?password|password reset|verify your (?:email|account)|confirm your (?:email|account)|verification code|sign[- ]?in code|security code|one[- ]time (?:code|password)|activate your account|your account (?:has been )?(?:created|activated)|new sign[- ]?in)\b/i;

const AGGREGATOR_DOMAINS = [
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'ziprecruiter.com',
  'joinhandshake.com',
  'handshake.com',
  'wayup.com',
  'simplify.jobs',
  'ripplematch.com',
  'monster.com',
  'careerbuilder.com',
  'google.com',
];

// ---------- sender parsing ----------

interface Sender {
  name: string | null;
  address: string;
  local: string;
  domain: string;
}

export function parseSender(from: string): Sender {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(from);
  const name = m ? (m[1]?.trim() ?? '') : '';
  const address = (m ? (m[2] ?? '') : from).trim().toLowerCase();
  const at = address.lastIndexOf('@');
  return {
    name: name ? name : null,
    address,
    local: at >= 0 ? address.slice(0, at) : address,
    domain: at >= 0 ? address.slice(at + 1) : '',
  };
}

const ATS_DOMAINS = [
  'greenhouse-mail.io',
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'myworkday.com',
  'myworkdayjobs.com',
  'workday.com',
  'icims.com',
  'smartrecruiters.com',
  'jobvite.com',
  'taleo.net',
  'successfactors.com',
  'successfactors.eu',
  'workable.com',
  'brassring.com',
  'rippling.com',
  'bamboohr.com',
  'hirevue.com',
  'codility.com',
  'hackerrank.com',
  'pymetrics.ai',
  'harver.com',
  'shl.com',
  'criteriacorp.com',
];

const GENERIC_SUBDOMAINS = new Set([
  'us', 'eu', 'uk', 'ca', 'hire', 'jobs', 'job', 'mail', 'email', 'em', 'e', 'mg', 'app', 'apps', 'careers',
  'career', 'www', 'notify', 'notifications', 'ext', 'recruiting', 'talent', 'apply', 'send', 'bounce', 'mailer',
  'smtp', 'ats', 'my', 'candidate', 'candidates',
]);

const GENERIC_LOCALS = /^(?:no[-_.]?reply|do[-_.]?not[-_.]?reply|donotreply|noreply|jobs?|careers?|recruit(?:ing|ment|er|ers)?|talent|hr|hiring|notifications?|notify|info|hello|team|campus|university|early[-_.]?(?:careers?|talent)|applications?|apply|support|mailer|updates?|alerts?|admin|workday|hire|people|staffing|candidates?|assessments?|tests?|invites?|invitations?|hirevue|status|careers[-_.]team)$/;

function registrable(domain: string): { base: string; subs: string[] } {
  const labels = domain.split('.').filter(Boolean);
  if (labels.length <= 2) return { base: labels.join('.'), subs: [] };
  const twoPart = /^(?:co|com|org|net|ac|gov|edu)$/.test(labels[labels.length - 2] ?? '') && (labels[labels.length - 1] ?? '').length === 2;
  const n = twoPart ? 3 : 2;
  return { base: labels.slice(-n).join('.'), subs: labels.slice(0, -n) };
}

function isAtsOrAggregator(domain: string): boolean {
  const { base } = registrable(domain);
  return ATS_DOMAINS.includes(base) || AGGREGATOR_DOMAINS.includes(base);
}

function isAggregator(domain: string): boolean {
  return AGGREGATOR_DOMAINS.includes(registrable(domain).base);
}

// ---------- company guess ----------

const COMPANY_KEYWORDS =
  /\b(?:inc|llc|ltd|corp|corporation|co|company|group|capital|partners|advisory|advisors|brands|media|consumer|bank|financial|holdings|ventures|labs|technologies|systems|solutions|consulting|associates|securities|industries|foods|health|energy|realty|street|sachs|stanley|bros|international|global|enterprises|studios|entertainment|network|networks|logistics|manufacturing|foundation|university)\b\.?/i;

const NOISE_RE =
  /\b(?:university |campus |early |student |internship |intern )?(?:recruiting|recruitment|recruiter|recruiters|talent acquisition|talent|careers?|jobs?|hiring|human resources|people team|people|hr|team|notifications?|no-?reply|do not reply|support|alerts?|apply|applications?|candidate experience|via [a-z]+)\b/gi;

const VENDOR_NAMES = new Set([
  'greenhouse', 'lever', 'ashby', 'ashbyhq', 'workday', 'myworkday', 'icims', 'smartrecruiters', 'jobvite', 'taleo',
  'successfactors', 'workable', 'brassring', 'hirevue', 'codility', 'hackerrank', 'pymetrics', 'harver', 'shl',
  'linkedin', 'indeed', 'glassdoor', 'ziprecruiter', 'handshake', 'wayup', 'simplify', 'ripplematch', 'monster',
  'careerbuilder', 'google', 'criteria', 'ats', 'rippling', 'bamboohr', 'codesignal', 'greenhouse-mail',
]);

const ABBREV = new Set(['co', 'inc', 'corp', 'ltd', 'llc', 'plc', 'l.l.c', 'st', 'jr', 'sr']);

function tidyName(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim();
  s = s.replace(/^(?:the)\s+/i, '');
  // drop a trailing period unless it ends a known abbreviation ("Co.", "Inc.")
  const last = /([A-Za-z.]+)\.$/.exec(s);
  if (last && !ABBREV.has((last[1] ?? '').toLowerCase())) s = s.slice(0, -1);
  s = s.replace(/[\s,;:!-]+$/, '').trim();
  // trailing department words captured from signatures ("Acme Capital Talent Acquisition")
  const toks = s.split(' ');
  while (toks.length > 1 && TRAILING_NOISE.has((toks[toks.length - 1] ?? '').toLowerCase())) toks.pop();
  return toks.join(' ');
}

const TRAILING_NOISE = new Set([
  'talent', 'acquisition', 'recruiting', 'recruitment', 'team', 'careers', 'career', 'campus', 'early', 'human',
  'resources', 'people', 'hr', 'hiring', 'jobs', 'relations', 'notifications', 'university', 'staffing',
]);

const NOT_COMPANY = new Set([
  'the', 'our', 'us', 'you', 'your', 'we', 'this', 'that', 'team', 'summer', 'fall', 'spring', 'winter', 'dear',
  'hi', 'hello', 'regards', 'thanks', 'thank', 'best', 'sincerely', 'action', 'required', 'update', 'reminder',
  'important', 'invitation', 'application', 'interview', 'assessment', 'offer', 'next', 'steps', 'congratulations',
  're', 'fwd', 'fw', 'new', 'your application', 'recruiting', 'careers', 'jobs', 'a', 'an', 'i', 'it', 'there',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'zoom', 'google meet', 'teams',
]);

const ROLE_END_RE = /\b(?:intern|interns|internship|internships|analyst|associate|position|role|program|opportunity|coordinator|assistant)$/i;

function plausibleCompany(name: string | null): name is string {
  if (!name) return false;
  const n = tidyName(name);
  if (n.length < 2 || n.length > 60) return false;
  const lower = n.toLowerCase();
  if (NOT_COMPANY.has(lower)) return false;
  if (VENDOR_NAMES.has(lower.replace(/\s+/g, ''))) return false;
  if (ROLE_END_RE.test(n)) return false;
  if (/^(?:summer|fall|spring|winter)\b/i.test(n)) return false;
  if (!/[A-Za-z]/.test(n)) return false;
  return true;
}

function cleanDisplayName(name: string, sender: Sender): string | null {
  const stripped = name.replace(/^["']+|["']+$/g, '').trim();
  // "SHL Talent Assessments", "HireVue Notifications": the vendor, not the employer
  const firstWord = (stripped.split(/[\s|]+/)[0] ?? '').toLowerCase().replace(/[^a-z-]/g, '');
  if (VENDOR_NAMES.has(firstWord)) return null;
  const pieces = stripped
    .split(/\s+[|•·]\s+|\s+-\s+|\s+via\s+|\s+at\s+|\s*\(|\)\s*|\s+from\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
  // "Careers at Acme" / "Jane at Acme": later pieces are the company
  const ordered = pieces.length > 1 ? [...pieces.slice(1), pieces[0] ?? ''] : pieces;
  for (const piece of ordered) {
    const cleaned = piece.replace(NOISE_RE, ' ').replace(/\s+/g, ' ').replace(/^[\s,&-]+|[\s,&-]+$/g, '');
    if (!plausibleCompany(cleaned)) continue;
    if (looksLikePerson(cleaned, sender)) continue;
    return tidyName(cleaned);
  }
  return null;
}

function looksLikePerson(name: string, sender: Sender): boolean {
  const toks = name.split(' ');
  if (toks.length < 2 || toks.length > 3) return false;
  if (!toks.every((t) => /^[A-Z][a-z]+\.?$/.test(t))) return false;
  if (COMPANY_KEYWORDS.test(name)) return false;
  // an organisation mailbox ("recruiting@", "no-reply@") means the name is the org
  if (GENERIC_LOCALS.test(sender.local)) return false;
  return true;
}

// The NAME token grammar is case-sensitive on purpose: company names are capitalised.
const TOK = String.raw`[A-Z0-9][A-Za-z0-9&'’\-]*\.?`;
const NAME_SRC = String.raw`${TOK}(?:\s+(?:${TOK}|&|(?:of|and|the)\s+${TOK}))*`;

function grabAt(text: string, from: number, tokenSrc: string): string | null {
  const re = new RegExp(tokenSrc, 'y');
  re.lastIndex = from;
  const m = re.exec(text);
  return m ? m[0] : null;
}

/** All captures of NAME right after any match of `lead` (case-insensitive lead-in). */
function namesAfter(text: string, lead: RegExp): string[] {
  const re = new RegExp(lead.source, lead.flags.includes('g') ? lead.flags : lead.flags + 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[0].length;
    const got = grabAt(text, end, NAME_SRC);
    if (got) out.push(got);
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

const ROLE_WORDS =
  /\b(?:interns?|internships?|analysts?|associates?|coordinators?|assistants?|specialists?|fellows?|fellowships?|trainees?|co-?ops?|apprentices?|representatives?|consultants?|managers?|developers?|engineers?|designers?|scientists?|researchers?|strategists?|externs?)\b/i;

function companyFromText(text: string): string | null {
  const leads: RegExp[] = [
    // "Marketing Intern position at Acme", "intern at Acme"
    /\b(?:position|role|internship|opportunity|program|analyst|intern|associate|coordinator|assistant|specialist)\s+(?:at|with)\s+(?:the\s+)?/i,
    // "application to Acme", "interview with Acme", "offer from Acme"
    /\b(?:application|applying|applied|interest|interview|assessment|offer|candidacy|invitation)\s+(?:to|at|with|in|from)\s+(?:the\s+)?/i,
    /\b(?:sent to|submitted to|received by|welcome to|joining|join)\s+(?:the\s+)?/i,
    /\bapply(?:ing)? to\s+/i,
  ];
  for (const lead of leads) {
    for (const cand of namesAfter(text, lead)) {
      const name = tidyName(cand);
      // "applying to the Marketing Intern position at X" must not return "Marketing Intern"
      if (plausibleCompany(name) && !ROLE_WORDS.test(name.split(' ').slice(-1).join(' '))) return name;
    }
  }
  return companyBeforeVerb(text);
}

/** "Magnolia Media Group has invited you to ..." (sentence-initial company + verb). */
function companyBeforeVerb(text: string): string | null {
  const re = new RegExp(
    String.raw`(?:^|[.!?\n]\s*)(${NAME_SRC})\s+(?:has invited|invites|is inviting|would like|is pleased|is excited|is delighted)\b`,
    'g',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const name = tidyName(m[1] ?? '');
    if (plausibleCompany(name)) return name;
  }
  return null;
}

const SUBJECT_PREFIX_STOP = new Set([
  'action required', 'update', 'reminder', 'important', 'invitation', 'application', 'interview', 'assessment',
  'offer', 'next steps', 'congratulations', 'fwd', 'fw', 're', 'urgent', 'final reminder', 'application update',
  'application received', 'interview invitation', 'online assessment', 'time sensitive', 'new', 'your application',
]);

function companyFromSubject(subject: string): string | null {
  const s = subject.replace(/^(?:\s*(?:re|fwd?|fw)\s*:\s*)+/i, '').trim();
  const fromText = companyFromText(s);
  if (fromText) return fromText;

  // "Your Acme application", "Your Acme Capital interview"
  const your = /\b[Yy]our\s+(.+?)\s+(?:application|interview|assessment|offer|candidacy)\b/.exec(s);
  if (your && your[1]) {
    const grabbed = grabAt(your[1], 0, NAME_SRC);
    if (grabbed && grabbed.length === your[1].trim().length && plausibleCompany(grabbed)) return tidyName(grabbed);
  }
  // "[Acme] Update", "Acme: Complete your assessment", "Acme | Interview"
  const prefix = /^\[?\s*(.+?)\s*\]?\s*[:|–—]\s/.exec(s) ?? /^\[(.+?)\]/.exec(s);
  if (prefix && prefix[1]) {
    const cand = prefix[1].trim();
    if (!SUBJECT_PREFIX_STOP.has(cand.toLowerCase()) && grabAt(cand, 0, NAME_SRC) === cand && plausibleCompany(cand)) {
      return tidyName(cand);
    }
  }
  // "... - Acme Capital" / "... | Acme" at the end
  const suffix = /\s[-–—|]\s+(.+?)\s*$/.exec(s);
  if (suffix && suffix[1]) {
    const cand = suffix[1].trim();
    if (!SUBJECT_PREFIX_STOP.has(cand.toLowerCase()) && grabAt(cand, 0, NAME_SRC) === cand && plausibleCompany(cand) && !ROLE_WORDS.test(cand)) {
      return tidyName(cand);
    }
  }
  return null;
}

function companyFromSignature(body: string): string | null {
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const tail = lines.slice(-8).reverse();
  for (const line of tail) {
    // "Peachtree Brands Talent Team", "The Acme Recruiting Team"
    const team = new RegExp(
      String.raw`^(?:The\s+)?(${NAME_SRC})\s+(?:University\s+|Campus\s+|Early\s+(?:Careers?\s+|Talent\s+)?)?(?:Recruiting|Recruitment|Talent|People|Hiring|HR|Human Resources|Careers|Campus|Team)\b`,
    ).exec(line);
    if (team && team[1] && plausibleCompany(team[1])) return tidyName(team[1]);
    // "University Recruiter, Acme Capital" / "Recruiting Coordinator | Acme"
    const title = new RegExp(
      String.raw`(?:Recruiter|Recruiting|Coordinator|Manager|Specialist|Associate|Partner|Director|Lead|Team|Talent)\s*(?:,|\||-|–|—|@|at)\s*(${NAME_SRC})\s*$`,
    ).exec(line);
    if (title && title[1] && plausibleCompany(title[1])) return tidyName(title[1]);
  }
  // a lone line that is clearly a company ("Larkspur Consumer Co.")
  for (const line of tail.slice(0, 4)) {
    if (grabAt(line, 0, NAME_SRC) === line && COMPANY_KEYWORDS.test(line) && plausibleCompany(line)) return tidyName(line);
  }
  return null;
}

function prettyLabel(label: string): string {
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function companyFromDomain(sender: Sender): string | null {
  if (!sender.domain) return null;
  const { base, subs } = registrable(sender.domain);
  if (isAtsOrAggregator(sender.domain)) {
    if (isAggregator(sender.domain)) return null;
    const sub = subs.find((s) => !GENERIC_SUBDOMAINS.has(s) && !/^wd\d+$/.test(s) && !/^(?:www\d*|mail\d*|click\d*)$/.test(s));
    if (sub) return prettyLabel(sub);
    if (!GENERIC_LOCALS.test(sender.local) && /^[a-z][a-z0-9-]{2,}$/.test(sender.local)) return prettyLabel(sender.local);
    return null;
  }
  const label = base.split('.')[0] ?? '';
  if (/^(?:gmail|yahoo|outlook|hotmail|icloud|aol|proton|protonmail|live|msn)$/.test(label)) return null;
  return label ? prettyLabel(label) : null;
}

function guessCompany(email: InboundEmail, sender: Sender): { value: string | null; source: string } {
  if (sender.name && !isAggregator(sender.domain)) {
    const fromName = cleanDisplayName(sender.name, sender);
    if (fromName) return { value: fromName, source: 'sender name' };
  }
  const fromSubject = companyFromSubject(email.subject);
  if (fromSubject) return { value: fromSubject, source: 'subject' };
  const fromSig = companyFromSignature(email.body);
  if (fromSig) return { value: fromSig, source: 'signature' };
  const fromBody = companyFromText(email.body);
  if (fromBody) return { value: fromBody, source: 'body' };
  const fromDomain = companyFromDomain(sender);
  if (fromDomain) return { value: fromDomain, source: 'sender domain' };
  return { value: null, source: '' };
}

// ---------- role guess ----------

const ROLE_TOK = String.raw`[A-Z0-9][A-Za-z0-9&'’/\-]*`;
const ROLE_SRC = String.raw`${ROLE_TOK}(?:\s+(?:${ROLE_TOK}|&|(?:of|and|in|for)\s+${ROLE_TOK}))*`;
const ROLE_TRAILING = /\s+(?:Position|Role|Opportunity|Program|Team|Application|Interview|Posting|Opening|Requisition)$/;

function tidyRole(raw: string): string | null {
  let s = raw.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 2; i++) s = s.replace(ROLE_TRAILING, '');
  s = s.replace(/[\s,;:!.-]+$/, '').trim();
  if (s.length < 4 || s.length > 90) return null;
  if (!ROLE_WORDS.test(s)) return null;
  if (/\b(?:thank|thanks|application|interview|invitation|congratulations|assessment|offer|update|reminder|received|next steps)\b/i.test(s) && !/^[A-Z0-9]/.test(s)) return null;
  return s;
}

function roleFromText(text: string): string | null {
  const leads: RegExp[] = [
    /\b(?:applying|applied|application|apply|interview|interviewing|candidacy|interest|offer|assessment|invitation)\s+(?:for|to|in)\s+(?:the\s+|our\s+|an?\s+)?/i,
    /\b(?:position|role|internship)\s+of\s+(?:the\s+|an?\s+)?/i,
    /\b(?:for|as)\s+(?:the\s+|our\s+|an?\s+)/i,
    /\b(?:for|as)\s+(?=(?:Summer|Fall|Spring|Winter|[A-Z]))/,
    /\b(?:the|our)\s+(?=(?:Summer|Fall|Spring|Winter)\s)/i,
  ];
  for (const lead of leads) {
    const re = new RegExp(lead.source, lead.flags.includes('g') ? lead.flags : lead.flags + 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const got = grabAt(text, m.index + m[0].length, ROLE_SRC);
      const role = got ? tidyRole(got) : null;
      if (role) return role;
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return null;
}

function roleFromSubjectSegments(subject: string): string | null {
  const s = subject.replace(/^(?:\s*(?:re|fwd?|fw)\s*:\s*)+/i, '').replace(/\(#?[\w-]+\)/g, ' ');
  const segs = s.split(/\s[-–—|]\s|:\s|\s+at\s+|\s+with\s+/).map((x) => x.trim()).filter(Boolean);
  for (const seg of segs) {
    if (!ROLE_WORDS.test(seg)) continue;
    if (seg.split(/\s+/).length > 9) continue;
    if (/\b(?:thank|thanks|application|interview|invitation|congratulations|assessment|offer|update|reminder|received|next steps|your|please)\b/i.test(seg)) continue;
    const role = tidyRole(seg);
    if (role) return role;
  }
  return null;
}

/** A short line that is just a title ("Social Media Marketing Intern"). */
function roleFromLines(body: string): string | null {
  for (const line of body.split(/\r?\n/).slice(0, 15)) {
    const t = line.trim();
    if (!t || t.length > 70 || /[.!?:]$/.test(t)) continue;
    if (grabAt(t, 0, ROLE_SRC) !== t) continue;
    const role = tidyRole(t);
    if (role && !/\b(?:your|please|thank|hi|dear)\b/i.test(role)) return role;
  }
  return null;
}

function guessRole(email: InboundEmail): string | null {
  const head = email.body.split(/\r?\n/).slice(0, 25).join('\n');
  return (
    roleFromText(email.subject) ??
    roleFromSubjectSegments(email.subject) ??
    roleFromText(head) ??
    roleFromLines(email.body)
  );
}

// ---------- scoring ----------

interface Hit {
  kind: ScoredKind;
  weight: number;
  phrase: string;
  where: 'subject' | 'body';
}

function dropHedged(text: string): string {
  return text
    .split(/(?<=[.!?])\s+|\r?\n/)
    .filter((sentence) => !HEDGE_RE.test(sentence) && !HEDGE2_RE.test(sentence))
    .join('\n');
}

function scan(subject: string, body: string): Hit[] {
  const hits: Hit[] = [];
  const subj = dropHedged(subject);
  const bod = dropHedged(body);
  const all = `${subj}\n${bod}`;
  for (const kind of Object.keys(RULES) as ScoredKind[]) {
    for (const rule of RULES[kind]) {
      if (rule.also && !rule.also.test(all)) continue;
      const sm = rule.re.exec(subj);
      if (sm) {
        hits.push({ kind, weight: rule.weight, phrase: sm[0], where: 'subject' });
        continue;
      }
      const bm = rule.re.exec(bod);
      if (bm) hits.push({ kind, weight: rule.weight, phrase: bm[0], where: 'body' });
    }
  }
  // weak "unfortunately" rejection language, only with candidacy context
  const um = UNFORTUNATELY_RE.exec(all);
  if (um) {
    const after = all.slice(um.index, um.index + 200);
    const ctx = REJECTION_CONTEXT_RE.test(after);
    hits.push({ kind: 'rejection', weight: ctx ? 0.7 : 0.4, phrase: 'unfortunately', where: all.indexOf(um[0]) < subj.length ? 'subject' : 'body' });
  }
  return hits;
}

function kindScores(hits: Hit[], bulk: boolean): Map<ScoredKind, { score: number; hits: Hit[] }> {
  const out = new Map<ScoredKind, { score: number; hits: Hit[] }>();
  for (const kind of PRIORITY) {
    const mine = hits.filter((h) => h.kind === kind).sort((a, b) => b.weight - a.weight);
    if (mine.length === 0) continue;
    const top = mine[0];
    if (!top) continue;
    let score = top.weight + 0.04 * Math.min(mine.length - 1, 3);
    if (top.where === 'subject') score += 0.02;
    if (bulk) score -= kind === 'applied-confirmation' ? 0.15 : 0.45;
    out.set(kind, { score: Math.min(score, 0.99), hits: mine });
  }
  return out;
}

export function classifyEmail(email: InboundEmail): EmailClassification {
  const sender = parseSender(email.from);
  const subject = email.subject ?? '';
  const body = email.body ?? '';
  const evidence: string[] = [];

  const company = guessCompany(email, sender);
  const role = guessRole(email);
  const finish = (kind: EmailKind, confidence: number, why: string[]): EmailClassification => {
    const ev = [...why];
    if (company.value) ev.push(`company "${company.value}" from ${company.source}`);
    if (role) ev.push(`role "${role}"`);
    return {
      kind,
      confidence: Math.round(Math.min(Math.max(confidence, 0), 0.99) * 100) / 100,
      companyGuess: company.value,
      roleGuess: role,
      evidence: ev,
    };
  };

  // Account / password mail is never a pipeline event.
  if (ACCOUNT_RE.test(subject)) {
    return finish('other', 0.95, [`account email: "${ACCOUNT_RE.exec(subject)?.[0] ?? ''}"`]);
  }

  const bulk = BULK_RE.test(`${subject}\n${body}`) || (isAggregator(sender.domain) && /\bjobs?\b.*\b(?:for you|alert|matching|recommended|new)\b/i.test(subject));
  if (bulk) evidence.push('newsletter / alert / event wording lowers all scores');

  const scores = kindScores(scan(subject, body), bulk);

  // Rejection language is decisive over "thank you for applying".
  const rej = scores.get('rejection');
  const app = scores.get('applied-confirmation');
  if (rej && rej.score >= 0.8 && app) scores.delete('applied-confirmation');
  // Later stages beat the confirmation phrases that ride along inside them.
  if (app) {
    for (const [k, v] of scores) {
      if (k !== 'applied-confirmation' && v.score >= 0.75) {
        scores.delete('applied-confirmation');
        break;
      }
    }
  }

  const ranked = [...scores.entries()]
    .map(([kind, v]) => ({ kind, ...v }))
    .sort((a, b) => b.score - a.score || PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));

  const best = ranked[0];
  if (!best || best.score < MIN_SCORE) {
    const base = bulk ? 0.88 : 0.7;
    return finish('other', base, [...evidence, 'no recruiting-stage language found']);
  }

  const second = ranked[1];
  let confidence = best.score;
  if (second && best.score - second.score < 0.08 && second.score >= MIN_SCORE) confidence -= 0.15;
  const why = [
    ...best.hits.slice(0, 3).map((h) => `${h.where}: "${h.phrase.trim()}"`),
    ...evidence,
  ];
  if (second && second.score >= MIN_SCORE) why.push(`also considered ${second.kind} (${second.score.toFixed(2)})`);
  return finish(best.kind, confidence, why);
}
