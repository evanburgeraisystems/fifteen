/** Internship detection. Title signals dominate; the description only breaks ties. */

const SENIOR_TITLE = /\b(senior|sr\.?|principal|staff|vice president|vp|director|managing director|head of|chief)\b/;

/** The posting is about running an intern program, not being an intern. */
const PROGRAM_STAFF_TITLE = [
  /\bintern(?:ship)?s?(?:\s+(?:program|programs|programme|experience|engagement|success|development))?\s*[,:\-–]?\s*(?:manager|coordinator|lead|director|recruiter|specialist|partner|owner|head)\b/,
  /\b(?:manager|coordinator|director|lead|recruiter|specialist|head|partner)\s*(?:,|-|–|of|for)\s*(?:the\s+)?(?:university\s+)?(?:interns|internships?|intern(?:ship)?\s+programs?)\b/,
  /\bformer\s+interns?\b/,
  /\bintern(?:ship)?\s+(?:program|programs|programme)\s+(?:manager|coordinator|lead|director)\b/,
];

const FULL_TIME_TITLE = /\b(new\s+grad(?:uate)?s?|graduate\s+(?:program|scheme|analyst)|full[- ]time\s+analyst|entry[- ]level\s+full[- ]time|apprentice(?:ship)?s?)\b/;

const INTERN_WORD = /\bintern(?:ship)?s?\b/;
const COOP = /\bco-?op\b|\bco-?operative\s+education\b/;
/** "Summer Analyst", "2027 Summer Associate", "Summer Investment Banking Analyst", "Analyst, Summer 2027". */
const PROGRAM_NOUN = '(?:analysts?|associates?|scholars?|fellows?|fellowship|programs?|programmes?|students?|undergraduates?|trainees?|researchers?|engineers?|developers?)';
const SUMMER_PROGRAM = new RegExp(
  `\\bsummer\\s+(?:20\\d\\d\\s+)?(?:[a-z&]+\\s+){0,2}?${PROGRAM_NOUN}\\b|\\b${PROGRAM_NOUN}\\s*[,:(|\\-–]\\s*(?:20\\d\\d\\s+)?summer\\b`,
);
const EARLY_PROGRAM = [
  /\binsight\s+(?:program|programme|day|week|event)s?\b/,
  /\bearly[- ](?:id|identification|insight|careers?)\b/,
  /\bspring\s+week\b/,
  /\b(?:sophomore|freshman|first[- ]year)\s+(?:program|programme|analyst|scholars?|fellowship|internship|insight|leadership|summit|associate)/,
  /\b(?:sophomore|freshman)\s+and\s+(?:sophomore|freshman|junior)\b.*\bprograms?\b/,
  /\bleadership\s+(?:summit|program|programme)\b.*\b(?:sophomore|freshman|first[- ]year)\b/,
  /\b(?:industrial\s+placement|placement\s+year|year\s+in\s+industry)\b/,
];

const STRONG_DESCRIPTION =
  /\bthis\s+(?:is\s+an?\s+)?(?:paid\s+)?(?:\d+[- ]week\s+|ten[- ]week\s+|twelve[- ]week\s+|summer\s+|full[- ]time\s+summer\s+)*(?:internship|intern\s+program|co-?op)\b|\b(?:\d+|eight|ten|twelve)[- ]weeks?\s+(?:summer\s+)?(?:internship|program)\b|\bsummer\s+(?:internship|analyst\s+program)\b/;
const RISING = /\brising\s+(?:sophomores?|juniors?|seniors?)\b/;
const WEAK_TITLE = /\b(analyst|associate|program|programme|scholars?|fellow|student|undergraduate|trainee|research assistant|assistant)\b/;
const FULL_TIME_DESCRIPTION = /\bthis\s+is\s+a\s+full[- ]time\s+(?:position|role|job)\b|\bnot\s+an?\s+internship\b|\bpermanent\s+(?:position|role)\b/;

export function detectInternship(title: string, description: string): boolean {
  const t = title.toLowerCase().replace(/\s+/g, ' ').trim();
  const d = description.toLowerCase();

  if (PROGRAM_STAFF_TITLE.some((re) => re.test(t))) return false;

  const internWord = INTERN_WORD.test(t);
  if (internWord) return true; // "Intern" in the title wins, even over "New Grad / Intern"

  if (COOP.test(t)) return true;
  if (FULL_TIME_TITLE.test(t)) return false;
  if (SENIOR_TITLE.test(t) && !EARLY_PROGRAM.some((re) => re.test(t))) return false;

  if (SUMMER_PROGRAM.test(t)) return true;
  if (EARLY_PROGRAM.some((re) => re.test(t))) return true;

  // Tie-breaker: title is silent; a loud description phrase can still tip it.
  if (FULL_TIME_DESCRIPTION.test(d)) return false;
  if (STRONG_DESCRIPTION.test(d) && WEAK_TITLE.test(t)) return true;
  if (RISING.test(d) && /\b(program|programme|analyst|scholars?|fellow)\b/.test(t) && !/\bfull[- ]time\b/.test(d.slice(0, 600))) return true;
  return false;
}
