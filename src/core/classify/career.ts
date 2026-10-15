/** Rules-first industry / career classification of a posting. */
import { familyOf } from '../taxonomy.ts';
import type { CareerId, Classification, IndustryId } from '../types.ts';

export interface RoleText {
  title: string;
  department: string | null;
  description: string;
  /** Industry hint from the company seed list. */
  companyIndustry: IndustryId;
}

interface Ctx {
  industry: IndustryId;
}

interface Rule {
  career: CareerId;
  re: RegExp;
  /** strong = a specific discipline word, generic = broad word like "finance" or "engineering". */
  strength: 'strong' | 'generic';
  when?: (ctx: Ctx) => boolean;
}

const isFinance = (ctx: Ctx): boolean => ctx.industry === 'finance';

/** Ordered: the first rule that matches wins, so specific disciplines come before broad ones. */
const RULES: Rule[] = [
  {
    career: 'people-hr',
    strength: 'strong',
    re: /\b(recruit(?:er|ers|ing|ment)|sourcer|talent (?:acquisition|management|partner|development|programs?)|people (?:operations|partner|analytics|team|experience|&|and) ?\w*|human resources|hr (?:business|generalist|analyst|operations|intern)|\bhr\b|hris|employee (?:experience|relations|engagement)|total rewards|learning (?:and|&) development)\b/,
  },
  // Quant roles at trading firms: desk-facing ones are business; builders are engineers.
  {
    career: 'sales-trading',
    strength: 'strong',
    re: /\bquant(?:itative)?\s+(?:trad\w*|research\w*|strateg\w*|analyst|associate|finance|portfolio|investment)\b/,
  },
  {
    career: 'software-engineering',
    strength: 'strong',
    re: /\b(software|swe|full[- ]?stack|front[- ]?end|back[- ]?end|devops|site reliability|sre|machine learning|ml engineer|ai engineer|mobile (?:engineer|developer)|firmware|embedded|platform engineer|security engineer|cloud engineer|data engineer(?:ing)?|systems? engineer|qa engineer|test engineer|(?:application|web|ios|android|quant(?:itative)?) (?:developer|engineer)|technology (?:summer )?(?:analyst|associate)|engineering (?:summer )?(?:analyst|associate)|information technology|cyber ?security|infosec|artificial intelligence)\b/,
  },
  {
    career: 'investment-banking',
    strength: 'strong',
    re: /\b(investment banking|investment banker|investment bank\b|ibd\b|m&a|mergers? (?:and|&) acquisitions?|capital markets|leveraged finance|lev ?fin\b|restructuring|debt capital|equity capital|\bdcm\b|\becm\b|industry coverage|coverage banking|(?<!private )(?<!retail )(?<!consumer )(?<!community )banking)\b/,
  },
  {
    career: 'sales-trading',
    strength: 'strong',
    re: /\b(sales (?:and|&|\/) trading|sales & trading|trading|traders?|global markets|markets|fixed income|equities|equity (?:sales|trading|derivatives)|foreign exchange|\bfx\b|rates (?:trading|sales)|commodit(?:y|ies) trading|market making|securitized|derivatives)\b/,
  },
  {
    career: 'data-science',
    strength: 'strong',
    re: /\b(data scien\w+|applied scien\w+|decision scien\w+|statistician)\b/,
  },
  {
    career: 'real-estate',
    strength: 'strong',
    re: /\b(real estate|reit\b|property (?:management|acquisitions?|development|investments?|manager|underwriting)|leasing|commercial real estate|\bcre\b)\b/,
  },
  {
    career: 'real-estate',
    strength: 'generic',
    re: /\bacquisitions?\b/,
    when: (ctx) => ctx.industry === 'real-estate',
  },
  {
    career: 'asset-management',
    strength: 'strong',
    re: /\b(asset manage(?:ment|r)|wealth|private (?:equity|bank|banking|wealth|credit)|venture capital|\bvc\b|growth equity|hedge fund|equity research|investment (?:research|management|analyst|professional|team|strategist|associate)|investment(?!\s+(?:operations|banking))|portfolio (?:manager|management|analyst)|credit (?:analyst|research)|endowment|family office|alternatives|buy[- ]side|financial advis[oe]r|fixed income research)\b/,
  },
  {
    career: 'accounting',
    strength: 'strong',
    re: /\b(account(?:ing|ant|ants)|audit(?:or|ors|ing)?|assurance|tax|cpa|bookkeep\w*|controllership|payroll|accounts (?:payable|receivable)|financial reporting)\b/,
  },
  {
    career: 'consulting',
    strength: 'strong',
    re: /\b(consult(?:ant|ants|ing|ancy)|advisory|case team|management consulting)\b/,
  },
  {
    career: 'product-management',
    strength: 'strong',
    re: /\b(product manage(?:r|ment)|\bapm\b|product owner|associate product|product lead|product strategy)\b/,
  },
  {
    career: 'marketing',
    strength: 'strong',
    re: /\b(marketing|brand|growth|content|social media|communications?|public relations|\bpr\b|copywrit\w*|seo\b|demand gen\w*|community|influencer|creative strategy|media planning|advertising|market research|consumer insights|merchandising|events?)\b/,
  },
  {
    career: 'sales',
    strength: 'strong',
    re: /\b(sales|business development|\bbdr\b|\bsdr\b|account (?:executive|manager|development)|partnerships?|customer success|inside sales|client (?:solutions|partner|service|advisor)|revenue operations|\brevops\b|retail banking|relationship (?:manager|banker))\b/,
  },
  {
    career: 'supply-chain',
    strength: 'strong',
    re: /\b(supply chain|logistics|procurement|(?:strategic )?sourcing|(?:demand|supply|production|inventory|materials?|merchandise|category) planning|warehouse|distribution|fulfillment|purchasing|buyer|vendor management|transportation)\b/,
  },
  {
    career: 'corporate-finance',
    strength: 'strong',
    re: /\b(fp&a|fpa\b|financial planning|corporate finance|treasury|financial analyst|financial analysis|strategic finance|business finance|controller|investor relations|capital planning)\b/,
  },
  {
    career: 'strategy',
    strength: 'strong',
    re: /\b(strateg(?:y|ic)|corporate development|corp dev|bizops|business operations (?:and|&) strategy|chief of staff)\b/,
  },
  {
    career: 'corporate-finance',
    strength: 'generic',
    re: /\b(finance|financial|risk|credit)\b/,
  },
  {
    career: 'operations',
    strength: 'strong',
    re: /\b(operations?|ops|program manager|project manager|project management|process improvement|continuous improvement|business operations|chief operating)\b/,
  },
  {
    career: 'business-analytics',
    strength: 'strong',
    re: /\b(business (?:analyst|intelligence|analytics)|data analy(?:st|sts|tics)|analytics|\bbi (?:analyst|developer)|insights? analyst|pricing analyst|reporting analyst|product analyst|decision support)\b/,
  },
  {
    // Hardware engineering has no business career; keep it out of business lanes.
    career: 'other',
    strength: 'strong',
    re: /\b(antenna|avionics|fpga|rf|radio frequency|power electronics|electrical|mechanical|aerospace|propulsion|firmware|embedded|hardware|harness|integration,? and test|asic|pcb|thermal|structures)\b/,
  },
  {
    career: 'software-engineering',
    strength: 'generic',
    re: /\b(engineer|engineering|developer|programmer|technology|technical|\bit\b)\b/,
  },
  {
    career: 'design',
    strength: 'strong',
    re: /\b(ux|ui|ux\/ui|user experience|product design|graphic design|visual design|designers?|industrial design|brand design|interaction design|design)\b/,
  },
  {
    career: 'asset-management',
    strength: 'generic',
    re: /\bresearch\b(?!\s+scientist)/,
    when: isFinance,
  },
  {
    career: 'research',
    strength: 'strong',
    re: /\b(research scientist|scientist|researcher|research|laborator\w*|biolog\w*|chemi\w*|clinical|r&d)\b/,
  },
];

/** Single-word departments that the shared rules do not cover. */
const DEPT_EXTRAS: { career: CareerId; re: RegExp }[] = [
  { career: 'product-management', re: /^product(?: team)?$/ },
  { career: 'people-hr', re: /^(?:people|talent|hr|culture)\b/ },
  { career: 'software-engineering', re: /^(?:technology|it|r&d|infrastructure|platform)$/ },
  { career: 'data-science', re: /^data\b/ },
  { career: 'marketing', re: /^(?:brand|creative|gtm|go[- ]to[- ]market)\b/ },
  { career: 'corporate-finance', re: /^(?:cfo|fp&a|accounting & finance)\b/ },
];

interface TitleMatch {
  career: CareerId;
  strength: 'strong' | 'generic';
  hit: string;
}

function matchRules(text: string, ctx: Ctx): TitleMatch | null {
  const t = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.when && !rule.when(ctx)) continue;
    const m = rule.re.exec(t);
    if (m) return { career: rule.career, strength: rule.strength, hit: m[0] };
  }
  return null;
}

// ---------- description keyword density (weakest signal) ----------

const DESCRIPTION_KEYWORDS: { career: CareerId; terms: string[] }[] = [
  { career: 'investment-banking', terms: ['mergers and acquisitions', 'm&a', 'pitch book', 'pitchbook', 'pitch books', 'leveraged finance', 'deal execution', 'coverage group', 'ipo', 'lbo', 'strategic advisory', 'capital raising'] },
  { career: 'sales-trading', terms: ['trading desk', 'sales and trading', 'market making', 'fixed income trading', 'liquidity', 'trade ideas', 'derivatives pricing', 'order flow'] },
  { career: 'asset-management', terms: ['portfolio management', 'portfolio manager', 'equity research', 'investment research', 'private equity', 'venture capital', 'limited partners', 'assets under management', 'stock pitch', 'fund performance'] },
  { career: 'corporate-finance', terms: ['fp&a', 'budgeting', 'forecasting', 'treasury', 'variance analysis', 'financial planning', 'month-end', 'cash management'] },
  { career: 'consulting', terms: ['client engagements', 'consulting', 'case team', 'client projects', 'advisory', 'client deliverables'] },
  { career: 'strategy', terms: ['corporate strategy', 'strategic initiatives', 'corporate development', 'bizops', 'strategic planning'] },
  { career: 'accounting', terms: ['audit', 'assurance', 'gaap', 'tax compliance', 'financial reporting', 'journal entries', 'reconciliations', 'internal controls'] },
  { career: 'marketing', terms: ['campaigns', 'brand', 'social media', 'content creation', 'seo', 'marketing', 'email marketing', 'customer acquisition'] },
  { career: 'sales', terms: ['prospecting', 'sales pipeline', 'quota', 'cold calling', 'lead generation', 'account executive', 'outbound', 'close deals'] },
  { career: 'operations', terms: ['operations', 'process improvement', 'workflow', 'operational efficiency', 'cross-functional'] },
  { career: 'supply-chain', terms: ['supply chain', 'logistics', 'procurement', 'inventory', 'demand planning', 'suppliers', 'vendors', 'warehouse'] },
  { career: 'business-analytics', terms: ['dashboards', 'tableau', 'power bi', 'kpis', 'data analysis', 'sql queries', 'business intelligence'] },
  { career: 'product-management', terms: ['product roadmap', 'user stories', 'product requirements', 'prds', 'product lifecycle', 'feature prioritization'] },
  { career: 'people-hr', terms: ['human resources', 'talent acquisition', 'onboarding', 'employee engagement', 'hris', 'candidate experience'] },
  { career: 'real-estate', terms: ['real estate', 'leasing', 'tenants', 'underwriting', 'reit', 'property management', 'rent roll'] },
  { career: 'software-engineering', terms: ['software development', 'codebase', 'code reviews', 'algorithms', 'apis', 'data structures', 'unit tests'] },
  { career: 'data-science', terms: ['machine learning models', 'statistical modeling', 'predictive models', 'data scientist', 'model training'] },
  { career: 'design', terms: ['design systems', 'wireframes', 'figma', 'user research', 'prototypes', 'visual design'] },
  { career: 'research', terms: ['laboratory', 'experiments', 'research scientist', 'peer-reviewed', 'lab work'] },
];

function countOccurrences(haystack: string, needle: string): number {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1 && n < 3) {
    // word-ish boundary on the left so "ipo" does not match "hippo" and "apis" does not match "rapist"
    const left = haystack.charAt(i - 1);
    const right = haystack.charAt(i + needle.length);
    if (!/[a-z0-9]/.test(left) && !/[a-z0-9]/.test(right)) n++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return n;
}

function descriptionVote(description: string): { career: CareerId; score: number; terms: string[] } | null {
  const text = description.toLowerCase().slice(0, 4000);
  let best: { career: CareerId; score: number; terms: string[] } | null = null;
  for (const { career, terms } of DESCRIPTION_KEYWORDS) {
    let score = 0;
    const hit: string[] = [];
    for (const term of terms) {
      const n = countOccurrences(text, term);
      if (n > 0) {
        score += n;
        hit.push(term);
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { career, score, terms: hit };
  }
  return best && best.score >= 2 ? best : null;
}

// ---------- industry override ----------

const ACCOUNTING_FIRM = /\b(big (?:four|4)|audit firm|public accounting|assurance practice)\b/i;
const FINANCE_ONLY_CAREERS: CareerId[] = ['investment-banking', 'sales-trading', 'asset-management'];

export function classifyRole(input: RoleText): Classification {
  const ctx: Ctx = { industry: input.companyIndustry };
  const evidence: string[] = [];
  let career: CareerId = 'other';
  let confidence = 0.1;
  let decidedBy: 'title' | 'department' | 'description' | 'none' = 'none';

  const titleMatch = matchRules(input.title, ctx);
  const dept = input.department?.trim() ?? '';
  let deptMatch: TitleMatch | null = null;
  if (dept) {
    deptMatch = matchRules(dept, ctx);
    if (!deptMatch) {
      const d = dept.toLowerCase();
      const extra = DEPT_EXTRAS.find((e) => e.re.test(d));
      if (extra) deptMatch = { career: extra.career, strength: 'generic', hit: dept };
    }
  }

  if (titleMatch) {
    career = titleMatch.career;
    confidence = titleMatch.strength === 'strong' ? 0.9 : 0.8;
    decidedBy = 'title';
    evidence.push(`title: "${input.title.trim()}"`);
    if (deptMatch && deptMatch.career === career) {
      confidence = Math.min(0.98, confidence + 0.05);
      evidence.push(`department: "${dept}"`);
    }
  } else if (deptMatch) {
    career = deptMatch.career;
    confidence = deptMatch.strength === 'strong' ? 0.7 : 0.6;
    decidedBy = 'department';
    evidence.push(`department: "${dept}"`);
  } else {
    const vote = descriptionVote(input.description);
    if (vote) {
      career = vote.career;
      confidence = Math.min(0.45, 0.2 + 0.05 * vote.score);
      decidedBy = 'description';
      evidence.push(`description: ${vote.terms.slice(0, 4).map((t) => `"${t}"`).join(', ')}`);
    } else {
      evidence.push('no title, department or description signal');
    }
  }

  let industry: IndustryId = input.companyIndustry;
  const head = `${input.title}\n${dept}\n${input.description.slice(0, 1500)}`;
  const firm = ACCOUNTING_FIRM.exec(head);
  if (firm && (career === 'accounting' || (career === 'other' && decidedBy !== 'title'))) {
    industry = 'accounting';
    if (industry !== input.companyIndustry) evidence.push(`industry: "${firm[0]}" -> accounting`);
  } else if (FINANCE_ONLY_CAREERS.includes(career) && decidedBy !== 'description' && input.companyIndustry !== 'finance') {
    industry = 'finance';
    evidence.push(`industry: ${career} roles are finance (company hint was ${input.companyIndustry})`);
  }

  return { industry, career, family: familyOf(career), method: 'rules', confidence: Math.round(confidence * 100) / 100, evidence };
}
