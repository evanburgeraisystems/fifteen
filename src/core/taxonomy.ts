import type { CareerId, CityId, ClassYear, IndustryId, RoleFamily } from './types.ts';

export const INDUSTRIES: { id: IndustryId; label: string }[] = [
  { id: 'finance', label: 'Finance' },
  { id: 'consulting', label: 'Consulting' },
  { id: 'accounting', label: 'Accounting' },
  { id: 'technology', label: 'Technology' },
  { id: 'consumer', label: 'Consumer & Retail' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'media', label: 'Media & Entertainment' },
  { id: 'industrials', label: 'Industrials' },
  { id: 'energy', label: 'Energy' },
  { id: 'real-estate', label: 'Real Estate' },
  { id: 'public-sector', label: 'Public Sector' },
];

export const CAREERS: { id: CareerId; label: string; family: RoleFamily }[] = [
  { id: 'investment-banking', label: 'Investment Banking', family: 'business' },
  { id: 'sales-trading', label: 'Sales & Trading', family: 'business' },
  { id: 'asset-management', label: 'Asset Management', family: 'business' },
  { id: 'corporate-finance', label: 'Corporate Finance', family: 'business' },
  { id: 'consulting', label: 'Consulting', family: 'business' },
  { id: 'strategy', label: 'Strategy', family: 'business' },
  { id: 'accounting', label: 'Accounting', family: 'business' },
  { id: 'marketing', label: 'Marketing', family: 'business' },
  { id: 'sales', label: 'Sales', family: 'business' },
  { id: 'operations', label: 'Operations', family: 'business' },
  { id: 'supply-chain', label: 'Supply Chain', family: 'business' },
  { id: 'business-analytics', label: 'Business Analytics', family: 'business' },
  { id: 'product-management', label: 'Product Management', family: 'business' },
  { id: 'people-hr', label: 'People & HR', family: 'business' },
  { id: 'real-estate', label: 'Real Estate', family: 'business' },
  { id: 'software-engineering', label: 'Software Engineering', family: 'engineering' },
  { id: 'data-science', label: 'Data Science', family: 'engineering' },
  { id: 'design', label: 'Design', family: 'design' },
  { id: 'research', label: 'Research', family: 'science' },
  { id: 'other', label: 'Other', family: 'other' },
];

export const BUSINESS_CAREERS = CAREERS.filter((c) => c.family === 'business');

export const CITIES: { id: CityId; label: string; short: string }[] = [
  { id: 'nyc', label: 'New York', short: 'NYC' },
  { id: 'chicago', label: 'Chicago', short: 'Chicago' },
  { id: 'sf-bay', label: 'SF Bay Area', short: 'SF Bay' },
  { id: 'boston', label: 'Boston', short: 'Boston' },
  { id: 'atlanta', label: 'Atlanta', short: 'Atlanta' },
  { id: 'los-angeles', label: 'Los Angeles', short: 'LA' },
  { id: 'seattle', label: 'Seattle', short: 'Seattle' },
  { id: 'dc', label: 'Washington, DC', short: 'DC' },
  { id: 'dallas', label: 'Dallas', short: 'Dallas' },
  { id: 'houston', label: 'Houston', short: 'Houston' },
  { id: 'charlotte', label: 'Charlotte', short: 'Charlotte' },
  { id: 'denver', label: 'Denver', short: 'Denver' },
  { id: 'austin', label: 'Austin', short: 'Austin' },
  { id: 'miami', label: 'Miami', short: 'Miami' },
  { id: 'philadelphia', label: 'Philadelphia', short: 'Philly' },
  { id: 'remote', label: 'Remote', short: 'Remote' },
  { id: 'other', label: 'Other US', short: 'Other' },
];

export const CLASS_YEARS: { id: ClassYear; label: string }[] = [
  { id: 'freshman', label: 'Freshman' },
  { id: 'sophomore', label: 'Sophomore' },
  { id: 'junior', label: 'Junior' },
  { id: 'senior', label: 'Senior' },
];

const industryLabel = new Map(INDUSTRIES.map((i) => [i.id, i.label]));
const careerLabel = new Map(CAREERS.map((c) => [c.id, c.label]));
const careerFamily = new Map(CAREERS.map((c) => [c.id, c.family]));
const cityLabel = new Map(CITIES.map((c) => [c.id, c.short]));

export const labelIndustry = (id: IndustryId): string => industryLabel.get(id) ?? id;
export const labelCareer = (id: CareerId): string => careerLabel.get(id) ?? id;
export const familyOf = (id: CareerId): RoleFamily => careerFamily.get(id) ?? 'other';
export const labelCity = (id: CityId): string => cityLabel.get(id) ?? id;

/**
 * City matching patterns, checked against lowercased location strings.
 * Order matters only for readability; a location can map to several cities.
 */
export const CITY_PATTERNS: { id: CityId; patterns: RegExp[] }[] = [
  { id: 'nyc', patterns: [/\bnew york\b/, /\bnyc\b/, /\bmanhattan\b/, /\bbrooklyn\b/, /\bjersey city\b/] },
  { id: 'chicago', patterns: [/\bchicago\b/] },
  { id: 'sf-bay', patterns: [/\bsan francisco\b/, /\bsf\b/, /\bbay area\b/, /\bpalo alto\b/, /\bmenlo park\b/, /\bmountain view\b/, /\bsan jose\b/, /\boakland\b/, /\bsunnyvale\b/, /\bredwood city\b/, /\bsan mateo\b/] },
  { id: 'boston', patterns: [/\bboston\b/, /\bcambridge, ma\b/] },
  { id: 'atlanta', patterns: [/\batlanta\b/] },
  { id: 'los-angeles', patterns: [/\blos angeles\b/, /\bsanta monica\b/, /\bculver city\b/, /\bbeverly hills\b/, /\bburbank\b/, /\birvine\b/] },
  { id: 'seattle', patterns: [/\bseattle\b/, /\bbellevue\b/, /\bredmond\b/] },
  { id: 'dc', patterns: [/\bwashington,? d\.?c\.?\b/, /\bwashington dc\b/, /\barlington, va\b/, /\bmclean\b/, /\bbethesda\b/] },
  { id: 'dallas', patterns: [/\bdallas\b/, /\bfort worth\b/, /\bplano\b/, /\birving, tx\b/] },
  { id: 'houston', patterns: [/\bhouston\b/] },
  { id: 'charlotte', patterns: [/\bcharlotte\b/] },
  { id: 'denver', patterns: [/\bdenver\b/, /\bboulder\b/] },
  { id: 'austin', patterns: [/\baustin\b/] },
  { id: 'miami', patterns: [/\bmiami\b/, /\bfort lauderdale\b/] },
  { id: 'philadelphia', patterns: [/\bphiladelphia\b/] },
  { id: 'remote', patterns: [/\bremote\b/, /\banywhere\b/, /\bwork from home\b/, /\bdistributed\b/] },
];
