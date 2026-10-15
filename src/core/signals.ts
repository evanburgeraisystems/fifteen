/**
 * The shared signal lexicon. Resume parsing and posting-requirement extraction
 * both map text onto these ids, so fit scoring is a comparison of two id sets
 * and every match or gap can be shown to the student in plain words.
 *
 * Kinds:
 *  - tool: software the posting names (Excel, SQL)
 *  - skill: a capability (financial modeling, copywriting)
 *  - major: a field of study (ids start with `major:`)
 *  - experience: a kind of prior experience (prior internship, leadership)
 *  - trait: soft requirements we do NOT score (communication, teamwork)
 */
export type SignalKind = 'tool' | 'skill' | 'major' | 'experience' | 'trait';

export interface Signal {
  id: string;
  label: string;
  kind: SignalKind;
  /** Lowercase phrases. Matched on word boundaries; `*` in a phrase is not supported. */
  aliases: string[];
}

export const SIGNALS: Signal[] = [
  // ---- tools ----
  { id: 'excel', label: 'Excel', kind: 'tool', aliases: ['excel', 'microsoft excel', 'ms excel', 'spreadsheets', 'spreadsheet', 'vlookup', 'pivot tables', 'pivot table'] },
  { id: 'powerpoint', label: 'PowerPoint', kind: 'tool', aliases: ['powerpoint', 'power point', 'slide decks', 'google slides', 'keynote'] },
  { id: 'sql', label: 'SQL', kind: 'tool', aliases: ['sql', 'mysql', 'postgresql', 'postgres', 'bigquery', 'snowflake'] },
  { id: 'python', label: 'Python', kind: 'tool', aliases: ['python', 'pandas', 'numpy', 'jupyter'] },
  { id: 'r-lang', label: 'R', kind: 'tool', aliases: ['r programming', 'rstudio', 'r studio', 'tidyverse'] },
  { id: 'tableau', label: 'Tableau', kind: 'tool', aliases: ['tableau'] },
  { id: 'power-bi', label: 'Power BI', kind: 'tool', aliases: ['power bi', 'powerbi'] },
  { id: 'salesforce', label: 'Salesforce', kind: 'tool', aliases: ['salesforce', 'sfdc'] },
  { id: 'hubspot', label: 'HubSpot', kind: 'tool', aliases: ['hubspot'] },
  { id: 'google-analytics', label: 'Google Analytics', kind: 'tool', aliases: ['google analytics', 'ga4'] },
  { id: 'bloomberg', label: 'Bloomberg Terminal', kind: 'tool', aliases: ['bloomberg terminal', 'bloomberg'] },
  { id: 'capital-iq', label: 'Capital IQ / FactSet', kind: 'tool', aliases: ['capital iq', 'capiq', 'factset', 'pitchbook'] },
  { id: 'sap', label: 'SAP / ERP', kind: 'tool', aliases: ['sap', 'erp', 'oracle erp', 'netsuite'] },
  { id: 'adobe-creative', label: 'Adobe Creative Suite', kind: 'tool', aliases: ['adobe creative', 'photoshop', 'illustrator', 'indesign', 'premiere', 'canva', 'figma'] },
  { id: 'quickbooks', label: 'QuickBooks', kind: 'tool', aliases: ['quickbooks'] },
  { id: 'vba', label: 'VBA', kind: 'tool', aliases: ['vba', 'macros'] },

  // ---- skills ----
  { id: 'financial-modeling', label: 'Financial modeling', kind: 'skill', aliases: ['financial modeling', 'financial modelling', 'financial model', 'three statement', '3-statement', 'lbo', 'dcf', 'discounted cash flow', 'merger model'] },
  { id: 'valuation', label: 'Valuation', kind: 'skill', aliases: ['valuation', 'valuations', 'comparable companies', 'comps', 'precedent transactions'] },
  { id: 'financial-analysis', label: 'Financial analysis', kind: 'skill', aliases: ['financial analysis', 'financial statements', 'financial statement analysis', 'ratio analysis', 'variance analysis'] },
  { id: 'accounting-principles', label: 'Accounting (GAAP)', kind: 'skill', aliases: ['gaap', 'accounting principles', 'financial accounting', 'journal entries', 'reconciliations', 'reconciliation', 'general ledger'] },
  { id: 'audit', label: 'Audit', kind: 'skill', aliases: ['audit', 'auditing', 'internal controls', 'sox'] },
  { id: 'tax', label: 'Tax', kind: 'skill', aliases: ['tax', 'taxation', 'tax return', 'tax returns'] },
  { id: 'budgeting', label: 'Budgeting & forecasting', kind: 'skill', aliases: ['budgeting', 'forecasting', 'fp&a', 'financial planning'] },
  { id: 'market-research', label: 'Market research', kind: 'skill', aliases: ['market research', 'competitive analysis', 'industry research', 'consumer insights', 'customer research', 'surveys'] },
  { id: 'data-analysis', label: 'Data analysis', kind: 'skill', aliases: ['data analysis', 'analyze data', 'analyzing data', 'data analytics', 'quantitative analysis', 'statistical analysis', 'statistics', 'data visualization', 'dashboards', 'dashboard'] },
  { id: 'problem-solving', label: 'Structured problem solving', kind: 'skill', aliases: ['case interview', 'case competition', 'hypothesis-driven', 'structured problem solving', 'problem-solving frameworks'] },
  { id: 'copywriting', label: 'Copywriting', kind: 'skill', aliases: ['copywriting', 'copy writing', 'content writing', 'blog posts', 'editorial'] },
  { id: 'social-media', label: 'Social media', kind: 'skill', aliases: ['social media', 'instagram', 'tiktok', 'content calendar', 'community management', 'influencer'] },
  { id: 'digital-marketing', label: 'Digital marketing', kind: 'skill', aliases: ['digital marketing', 'seo', 'sem', 'paid media', 'paid social', 'performance marketing', 'email marketing', 'growth marketing', 'a/b testing'] },
  { id: 'brand', label: 'Brand management', kind: 'skill', aliases: ['brand management', 'brand strategy', 'brand marketing', 'go-to-market', 'go to market', 'product marketing'] },
  { id: 'sales-skills', label: 'Sales & prospecting', kind: 'skill', aliases: ['prospecting', 'cold calling', 'lead generation', 'pipeline management', 'quota', 'business development', 'account management'] },
  { id: 'customer-service', label: 'Customer-facing work', kind: 'skill', aliases: ['customer service', 'client-facing', 'client facing', 'customer facing', 'customer-facing', 'retail experience'] },
  { id: 'project-management', label: 'Project management', kind: 'skill', aliases: ['project management', 'project manager', 'managing projects', 'agile', 'scrum', 'project coordination'] },
  { id: 'process-improvement', label: 'Process improvement', kind: 'skill', aliases: ['process improvement', 'lean manufacturing', 'lean six sigma', 'six sigma', 'continuous improvement', 'kaizen', 'process optimization'] },
  { id: 'logistics', label: 'Logistics & procurement', kind: 'skill', aliases: ['logistics', 'procurement', 'strategic sourcing', 'inventory management', 'inventory', 'demand planning', 'supply planning', 'warehouse operations', 'distribution center', 'purchasing'] },
  { id: 'recruiting', label: 'Recruiting', kind: 'skill', aliases: ['recruiting', 'talent acquisition', 'sourcing candidates', 'hris'] },
  { id: 'real-estate-analysis', label: 'Real estate analysis', kind: 'skill', aliases: ['real estate', 'underwriting', 'argus', 'property management', 'leasing'] },
  { id: 'investing', label: 'Investing & markets', kind: 'skill', aliases: ['equity research', 'investment research', 'portfolio management', 'stock pitch', 'investment club', 'capital markets', 'fixed income', 'equities', 'derivatives', 'trading'] },
  { id: 'research-writing', label: 'Research & writing', kind: 'skill', aliases: ['research papers', 'research skills', 'written communication', 'writing skills', 'memo writing', 'report writing'] },
  { id: 'product-sense', label: 'Product thinking', kind: 'skill', aliases: ['product management', 'product roadmap', 'user research', 'requirements gathering', 'user stories'] },
  { id: 'programming', label: 'Programming', kind: 'skill', aliases: ['programming', 'coding', 'javascript', 'java', 'c++', 'software development'] },
  { id: 'spanish', label: 'Spanish', kind: 'skill', aliases: ['spanish', 'bilingual'] },

  // ---- majors ----
  { id: 'major:finance', label: 'Finance major', kind: 'major', aliases: ['finance', 'financial engineering'] },
  { id: 'major:accounting', label: 'Accounting major', kind: 'major', aliases: ['accounting', 'accountancy'] },
  { id: 'major:economics', label: 'Economics major', kind: 'major', aliases: ['economics', 'econ'] },
  { id: 'major:business', label: 'Business major', kind: 'major', aliases: ['business administration', 'business', 'commerce', 'management'] },
  { id: 'major:marketing', label: 'Marketing major', kind: 'major', aliases: ['marketing'] },
  { id: 'major:supply-chain', label: 'Supply chain major', kind: 'major', aliases: ['supply chain', 'operations management', 'logistics'] },
  { id: 'major:information-systems', label: 'Information systems major', kind: 'major', aliases: ['information systems', 'mis', 'business analytics', 'analytics'] },
  { id: 'major:stem', label: 'STEM major', kind: 'major', aliases: ['engineering', 'mathematics', 'math', 'statistics', 'computer science', 'physics', 'data science'] },
  { id: 'major:communications', label: 'Communications major', kind: 'major', aliases: ['communications', 'communication', 'journalism', 'public relations', 'advertising'] },
  { id: 'major:hr', label: 'HR major', kind: 'major', aliases: ['human resources', 'industrial relations', 'organizational behavior'] },
  { id: 'major:real-estate', label: 'Real estate major', kind: 'major', aliases: ['real estate'] },

  // ---- experience ----
  { id: 'exp:internship', label: 'Prior internship', kind: 'experience', aliases: ['prior internship', 'previous internship', 'internship experience', 'intern experience'] },
  { id: 'exp:leadership', label: 'Leadership role', kind: 'experience', aliases: ['leadership', 'president', 'vice president', 'captain', 'founder', 'co-founder', 'led a team', 'student organization'] },
  { id: 'exp:work', label: 'Work experience', kind: 'experience', aliases: ['work experience', 'part-time job', 'part time job', 'job experience'] },

  // ---- traits (never scored) ----
  { id: 'trait:communication', label: 'Communication', kind: 'trait', aliases: ['communication skills', 'verbal communication', 'interpersonal'] },
  { id: 'trait:teamwork', label: 'Teamwork', kind: 'trait', aliases: ['teamwork', 'team player', 'collaborative', 'collaboration'] },
  { id: 'trait:detail', label: 'Attention to detail', kind: 'trait', aliases: ['attention to detail', 'detail-oriented', 'detail oriented'] },
];

const byId = new Map(SIGNALS.map((s) => [s.id, s]));

export const signalById = (id: string): Signal | undefined => byId.get(id);
export const signalLabel = (id: string): string => byId.get(id)?.label ?? id;
export const isScored = (id: string): boolean => {
  const s = byId.get(id);
  return !!s && s.kind !== 'trait';
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Precompiled matchers: one regex per signal, word-boundary aware (handles "c++", "fp&a", "a/b"). */
const MATCHERS: { signal: Signal; re: RegExp }[] = SIGNALS.map((signal) => ({
  signal,
  re: new RegExp(
    `(?:^|[^a-z0-9+&/])(?:${signal.aliases
      .slice()
      .sort((a, b) => b.length - a.length)
      .map(escapeRe)
      .join('|')})(?=$|[^a-z0-9+&/])`,
    'i',
  ),
}));

/**
 * Find every signal mentioned in a piece of text.
 * `kinds` limits the search (e.g. only majors).
 */
export function findSignals(text: string, kinds?: SignalKind[]): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  for (const { signal, re } of MATCHERS) {
    if (kinds && !kinds.includes(signal.kind)) continue;
    if (re.test(t)) out.push(signal.id);
  }
  return out;
}
