/** Required vs preferred signals, GPA floor and majors from a posting description. */
import { findSignals } from '../signals.ts';
import type { SignalKind } from '../signals.ts';
import type { Requirements } from '../types.ts';

type Section = 'required' | 'preferred' | 'other';

const HEAD_TAIL = String.raw`(?:\s+(?:to|for)\s+[a-z ]{1,25}|\s*(?:&|and)\s+[a-z ]{1,20}|\s*\([^)]*\)|\s*[-–—]\s*[a-z ]{0,25})?`;

const PREFERRED_HEADING = new RegExp(
  String.raw`^[\s•*\-#]*(?:(?:preferred|desired|desirable|bonus|additional)(?: (?:qualifications|skills|requirements|experience|attributes|points))?|nice[- ]to[- ]haves?|a plus|pluses|ideally|extra credit|it['’]s a plus|great to have|what (?:would|will) (?:make|set) you (?:stand out|apart)|plus)\b${HEAD_TAIL}\s*:?\s*$`,
  'i',
);
const REQUIRED_HEADING = new RegExp(
  String.raw`^[\s•*\-#]*(?:(?:minimum|basic|required|key|mandatory|essential)\s+)?(?:requirements?|qualifications?|skills(?: and| &) (?:experience|qualifications|requirements)|what you['’]?ll need|what you(?:['’]ll)? (?:will )?(?:need|bring|have)|what you need|who you are|you have|you['’]ll need|you will need|you should have|you bring|what we['’]re looking for|what we are looking for|about you|the ideal candidate|must[- ]haves?|required (?:skills|qualifications|experience)|minimum (?:qualifications|requirements)|basic qualifications|eligibility|qualifications? (?:and|&) skills|your profile|who we(?:['’]re| are) looking for)\b${HEAD_TAIL}\s*:?\s*$`,
  'i',
);
const OTHER_HEADING = new RegExp(
  String.raw`^[\s•*\-#]*(?:responsibilities|key responsibilities|what you['’]?ll do|what you will do|your (?:role|impact)|the role|about (?:the|this) (?:role|team|us|company|internship|program|opportunity|job)|about [a-z0-9&.' ]{2,30}|overview|job description|benefits|perks|compensation|salary|pay|location|how to apply|application process|our (?:mission|values|culture|team)|equal (?:opportunity|employment)|diversity|why (?:join|work)|program details|what we offer|internship details|timeline|the team|company overview|who we are|about the internship|day[- ]to[- ]day|in this role)\b${HEAD_TAIL}\s*:?\s*$`,
  'i',
);

/** "Requirements: Excel; pursuing a degree" -> heading + inline content. */
const INLINE_HEADING =
  /^[\s•*\-#]*((?:minimum |basic |required |preferred )?(?:qualifications|requirements)|preferred(?: skills| qualifications)?|nice[- ]to[- ]haves?|bonus(?: points)?|what you['’]?ll need|what you['’]?ll bring|responsibilities)\s*:\s*(.+)$/i;

const LINE_PREFERRED_CUE = /\b(?:a plus|is a plus|are a plus|nice to have|preferred|bonus|ideally|desirable|helpful|is an advantage|an asset|not required|a big plus)\b/i;
const LINE_REQUIRED_CUE = /\b(?:required|requires?|must|need(?:s|ed)?|minimum|essential|proficien(?:t|cy)|should have|mandatory|you have|you bring|currently pursuing|working toward)\b/i;
const NON_MAJOR: SignalKind[] = ['tool', 'skill', 'experience', 'trait'];
const MAJOR_ONLY: SignalKind[] = ['major'];

function headingKind(line: string): Section | null {
  const t = line.trim();
  if (t.length === 0 || t.length > 90) return null;
  if (PREFERRED_HEADING.test(t)) return 'preferred';
  if (REQUIRED_HEADING.test(t)) return 'required';
  if (OTHER_HEADING.test(t)) return 'other';
  return null;
}

/** Force a newline before headings that appear mid-paragraph in flattened descriptions. */
function splitInlineHeadings(text: string): string {
  return text.replace(
    /([.;!?])\s+((?:minimum |basic |preferred |required )?(?:qualifications|requirements)|nice[- ]to[- ]haves?|bonus points?|preferred(?: skills| qualifications)?|what you['’]ll (?:need|bring|do)|responsibilities):/gi,
    '$1\n$2:',
  );
}

export function extractRequirements(description: string): Requirements {
  const text = splitInlineHeadings(description.replace(/\r\n?/g, '\n'));
  const lines = text.split('\n');

  const required: string[] = [];
  const preferred: string[] = [];
  const loose: string[] = [];
  const looseRequired: string[] = [];
  let section: Section = 'other';
  let sectionsFound = false;

  const put = (line: string): void => {
    if (section === 'required') {
      (LINE_PREFERRED_CUE.test(line) ? preferred : required).push(line);
    } else if (section === 'preferred') {
      preferred.push(line);
    } else {
      loose.push(line);
      if (LINE_REQUIRED_CUE.test(line) && !LINE_PREFERRED_CUE.test(line)) looseRequired.push(line);
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const inline = INLINE_HEADING.exec(line);
    if (inline) {
      const kind = headingKind(`${inline[1] ?? ''}:`);
      if (kind) {
        section = kind;
        if (kind !== 'other') sectionsFound = true;
        if (inline[2]) put(inline[2]);
        continue;
      }
    }
    const kind = headingKind(line);
    if (kind) {
      section = kind;
      if (kind !== 'other') sectionsFound = true;
      continue;
    }
    put(line);
  }

  let requiredIds: string[];
  let preferredIds: string[];
  if (sectionsFound) {
    requiredIds = findSignals(required.join('\n'), NON_MAJOR);
    preferredIds = findSignals(preferred.join('\n'), NON_MAJOR).filter((id) => !requiredIds.includes(id));
  } else {
    requiredIds = findSignals(looseRequired.join('\n'), NON_MAJOR);
    preferredIds = findSignals(loose.join('\n'), NON_MAJOR).filter((id) => !requiredIds.includes(id));
  }

  return { required: requiredIds, preferred: preferredIds, minGpa: extractMinGpa(text), majors: extractMajors(text) };
}

// ---------- majors ----------

const MAJOR_CUE = /\b(?:majors?|majoring|degree|degrees|pursuing|studying|concentration|concentrating|field of study|fields of study|bachelor['’]?s|undergraduate|coursework|enrolled in|candidate for|background in)\b/i;

function extractMajors(text: string): string[] {
  const sentences = text.split(/\n|(?<=[.!?])\s+(?=[A-Z•])/);
  const found = new Set<string>();
  for (const s of sentences) {
    const cue = MAJOR_CUE.exec(s);
    if (!cue) continue;
    // Only look at what follows the cue: "our business ... pursuing a degree in finance".
    const tail = s.slice(cue.index);
    for (const id of findSignals(tail, MAJOR_ONLY)) found.add(id);
  }
  return [...found];
}

// ---------- GPA ----------

function extractMinGpa(text: string): number | null {
  const hits: { index: number; gpa: number }[] = [];
  const push = (index: number, raw: string | undefined): void => {
    if (!raw) return;
    const gpa = Number(raw);
    if (gpa > 0 && gpa <= 4.0) hits.push({ index, gpa });
  };
  // "3.5 GPA", "3.5/4.0 GPA", "3.0+ GPA", "3.0 minimum GPA", "3.5 cumulative GPA"
  for (const m of text.matchAll(/(?<![\d.])([0-4]\.\d{1,2})\+?\s*(?:\/\s*4(?:\.0+)?\s*)?(?:cumulative\s+|overall\s+|minimum\s+|min\.?\s+|or higher\s+|or above\s+)?gpa\b/gi)) {
    push(m.index, m[1]);
  }
  // "GPA of 3.3 or higher", "GPA: 3.0", "minimum GPA of at least 3.2"
  for (const m of text.matchAll(/\bgpa\b[^0-9.\n]{0,40}?(?<![\d.])([0-4]\.\d{1,2})(?!\d)(?!\s*(?:scale|point))/gi)) {
    const gap = m[0].toLowerCase();
    if (/\bscale\b|out of/.test(gap)) continue; // "GPA (on a 4.0 scale)"
    push(m.index, m[1]);
  }
  hits.sort((a, b) => a.index - b.index);
  return hits[0]?.gpa ?? null;
}
