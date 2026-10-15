/**
 * Source text for the four fictional resume personas. One module feeds:
 *  - scripts/make-resume-fixtures.ts (renders each into a real PDF or DOCX), and
 *  - the resume tests / e2e specs (the text is the ground truth for parseProfile).
 *
 * Everything here is invented: names, schools, employers, phone numbers (555 prefix).
 * Characters stay inside Windows-1252 so the minimal PDF writer can encode them.
 */
import type { ClassYear } from '../../../src/core/types.ts';

export interface PersonaExpectation {
  name: string;
  email: string;
  school: string;
  gpa: number;
  gradYear: number;
  /** Class year on 2026-10-15 (academic year ending spring 2027). */
  classYear: ClassYear;
  /** `major:*` ids that must be present. */
  majors: string[];
  /** Signal ids that must be present in profile.skills. */
  skills: string[];
  /** Signal ids that must NOT be present (guards against false positives). */
  notSkills: string[];
  /** Coursework entries expected (subset, exact strings). */
  coursework: string[];
  /** Titles that must appear among profile.experience[].title. */
  titles: string[];
}

export interface Persona {
  slug: string;
  /** File name written to e2e/fixtures/resumes/. */
  file: string;
  kind: 'pdf' | 'docx';
  lines: string[];
  expected: PersonaExpectation;
}

const maya: string[] = [
  'Maya Chen',
  'New York, NY | maya.chen@example.com | (212) 555-0143',
  '',
  'EDUCATION',
  'Easton University, New York, NY',
  'B.S. in Finance, minor in Economics - Expected May 2030',
  'GPA: 3.9/4.0',
  'Relevant Coursework: Microeconomics, Financial Accounting, Calculus I, Introduction to Statistics',
  '',
  'EXPERIENCE',
  'Analyst, Easton Investment Club - Sep 2026 to Present',
  '- Built an Excel model comparing three consumer stocks and pitched the recommendation to 40 members',
  '- Presented findings in PowerPoint decks to the club portfolio committee',
  '',
  'Camp Counselor, Riverside Day Camp - Summer 2026',
  '- Led a team of 6 counselors and ran daily schedules for 80 campers',
  '',
  'LEADERSHIP',
  'Freshman Representative, Easton Finance Society - Sep 2026 to Present',
  '',
  'SKILLS',
  'Excel, PowerPoint, Microsoft Word, Spanish (conversational)',
];

const jordan: string[] = [
  'Jordan Ellis',
  'Atlanta, GA | jordan.ellis@example.com | (404) 555-0188',
  '',
  'EDUCATION',
  'Piedmont State University, Atlanta, GA',
  'Bachelor of Business Administration in Marketing | Aug 2025 – May 2029',
  'GPA: 3.6/4.0',
  'Relevant Coursework: Principles of Marketing; Consumer Behavior; Business Statistics; Principles of Accounting',
  '',
  'EXPERIENCE',
  'Campus Ambassador, Glow Collective | Jan 2026 – Present',
  '• Planned 6 on-campus pop-ups and grew the brand Instagram following by 1,900 in one semester',
  '• Wrote weekly captions and kept a content calendar in Canva and Google Sheets',
  '',
  'Social Media Coordinator, Piedmont Student Media | Sep 2025 – Present',
  '• Ran TikTok and Instagram for a 5,000-follower student newspaper and tracked reach in Google Analytics',
  '• Wrote newsletter copywriting and A/B testing of subject lines',
  '',
  'Barista, Corner Roast Cafe | Jun 2025 – Aug 2025',
  '',
  'ACTIVITIES',
  'Vice President of Marketing, American Marketing Association chapter',
  '',
  'SKILLS',
  'Canva, Google Analytics, Copywriting, Social Media, Adobe Photoshop, Spanish',
];

const sam: string[] = [
  'Sam Rivera',
  'Chicago, IL | sam.rivera@example.com | (312) 555-0127',
  '',
  'EDUCATION',
  'Northlake University, Chicago, IL',
  'B.S. in Supply Chain Management and Economics - Expected May 2028',
  'GPA: 3.5/4.0',
  'Relevant Coursework: Operations Management, Logistics and Transportation, Econometrics, Database Systems',
  '',
  'EXPERIENCE',
  'Logistics Intern, Midway Freight Solutions, Chicago, IL - Jun 2026 to Aug 2026',
  '- Cut average dock-to-stock time by 14% by redesigning the receiving workflow (process improvement)',
  '- Built weekly Tableau dashboards on carrier on-time performance and queried shipment data in SQL',
  '- Maintained purchase orders and inventory counts in SAP',
  '',
  'Teaching Assistant, Northlake University - Jan 2026 to May 2026',
  'Warehouse Associate, Lakefront Distribution - 2024 to 2025',
  '',
  'LEADERSHIP',
  'Captain, Northlake Club Volleyball',
  'Treasurer, Supply Chain Management Association',
  '',
  'SKILLS',
  'Excel (pivot tables, VLOOKUP), SQL, Tableau, SAP, Lean Six Sigma Yellow Belt, Spanish',
];

const priya: string[] = [
  'Priya Natarajan',
  'Philadelphia, PA | priya.natarajan@example.com | (215) 555-0199',
  '',
  'EDUCATION',
  'Ridgemont University, Philadelphia, PA',
  'Bachelor of Science in Finance - Class of 2028',
  "GPA: 3.8/4.0 (Dean's List)",
  'Relevant Coursework: Corporate Finance; Valuation; Fixed Income; Financial Accounting; Econometrics',
  '',
  'EXPERIENCE',
  'Summer Analyst Intern, Redfern Partners, New York, NY - Jun 2026 to Aug 2026',
  '- Built a 3-statement financial model and DCF for a $200M healthcare services sell-side process',
  '- Prepared comparable companies and precedent transactions analyses using Capital IQ and Bloomberg',
  '- Drafted pages for the management presentation in PowerPoint',
  '',
  'Research Assistant, Ridgemont Finance Department - Sep 2025 to May 2026',
  '',
  'LEADERSHIP',
  'President, Ridgemont Investment Banking Society',
  '',
  'SKILLS',
  'Financial modeling, Valuation, Bloomberg Terminal, Capital IQ, Excel, PowerPoint, VBA',
];

export const PERSONAS: Persona[] = [
  {
    slug: 'freshman-maya',
    file: 'freshman-maya.pdf',
    kind: 'pdf',
    lines: maya,
    expected: {
      name: 'Maya Chen',
      email: 'maya.chen@example.com',
      school: 'Easton University',
      gpa: 3.9,
      gradYear: 2030,
      classYear: 'freshman',
      majors: ['major:finance', 'major:economics'],
      skills: ['excel', 'powerpoint', 'investing', 'spanish', 'exp:leadership'],
      notSkills: ['exp:internship', 'sql', 'tableau'],
      coursework: ['Microeconomics', 'Financial Accounting', 'Calculus I', 'Introduction to Statistics'],
      titles: ['Analyst', 'Camp Counselor'],
    },
  },
  {
    slug: 'sophomore-jordan',
    file: 'sophomore-jordan.docx',
    kind: 'docx',
    lines: jordan,
    expected: {
      name: 'Jordan Ellis',
      email: 'jordan.ellis@example.com',
      school: 'Piedmont State University',
      gpa: 3.6,
      gradYear: 2029,
      classYear: 'sophomore',
      majors: ['major:marketing'],
      skills: ['social-media', 'adobe-creative', 'copywriting', 'google-analytics', 'exp:leadership'],
      notSkills: ['sql', 'financial-modeling', 'exp:internship'],
      coursework: ['Principles of Marketing', 'Consumer Behavior', 'Business Statistics', 'Principles of Accounting'],
      titles: ['Campus Ambassador', 'Social Media Coordinator', 'Barista'],
    },
  },
  {
    slug: 'junior-sam',
    file: 'junior-sam.pdf',
    kind: 'pdf',
    lines: sam,
    expected: {
      name: 'Sam Rivera',
      email: 'sam.rivera@example.com',
      school: 'Northlake University',
      gpa: 3.5,
      gradYear: 2028,
      classYear: 'junior',
      majors: ['major:supply-chain', 'major:economics'],
      skills: ['excel', 'sql', 'tableau', 'sap', 'logistics', 'process-improvement', 'exp:internship', 'exp:leadership'],
      notSkills: ['financial-modeling', 'bloomberg'],
      coursework: ['Operations Management', 'Logistics and Transportation', 'Econometrics', 'Database Systems'],
      titles: ['Logistics Intern', 'Teaching Assistant', 'Warehouse Associate'],
    },
  },
  {
    slug: 'junior-priya',
    file: 'junior-priya.pdf',
    kind: 'pdf',
    lines: priya,
    expected: {
      name: 'Priya Natarajan',
      email: 'priya.natarajan@example.com',
      school: 'Ridgemont University',
      gpa: 3.8,
      gradYear: 2028,
      classYear: 'junior',
      majors: ['major:finance'],
      skills: ['financial-modeling', 'valuation', 'bloomberg', 'capital-iq', 'excel', 'powerpoint', 'vba', 'exp:internship', 'exp:leadership'],
      notSkills: ['sql', 'tableau', 'social-media'],
      coursework: ['Corporate Finance', 'Valuation', 'Fixed Income', 'Financial Accounting', 'Econometrics'],
      titles: ['Summer Analyst Intern', 'Research Assistant', 'President'],
    },
  },
];
