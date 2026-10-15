/**
 * Shared types for Fifteen. Pure TypeScript: used by the pull pipeline (Node)
 * and the app (browser). Only erasable syntax (no enums, no namespaces).
 */

export type SourceId = 'greenhouse' | 'lever' | 'ashby' | 'demo';

/** Role family. MVP ships `business`; the schema is ready for every family. */
export type RoleFamily = 'business' | 'engineering' | 'design' | 'science' | 'other';

export type IndustryId =
  | 'finance'
  | 'consulting'
  | 'accounting'
  | 'technology'
  | 'consumer'
  | 'healthcare'
  | 'media'
  | 'industrials'
  | 'energy'
  | 'real-estate'
  | 'public-sector';

export type CareerId =
  // business family
  | 'investment-banking'
  | 'sales-trading'
  | 'asset-management'
  | 'corporate-finance'
  | 'consulting'
  | 'strategy'
  | 'accounting'
  | 'marketing'
  | 'sales'
  | 'operations'
  | 'supply-chain'
  | 'business-analytics'
  | 'product-management'
  | 'people-hr'
  | 'real-estate'
  // non-business families (classified, hidden in MVP)
  | 'software-engineering'
  | 'data-science'
  | 'design'
  | 'research'
  | 'other';

export type CityId =
  | 'nyc'
  | 'chicago'
  | 'sf-bay'
  | 'boston'
  | 'atlanta'
  | 'los-angeles'
  | 'seattle'
  | 'dc'
  | 'dallas'
  | 'houston'
  | 'charlotte'
  | 'denver'
  | 'austin'
  | 'miami'
  | 'philadelphia'
  | 'remote'
  | 'other';

export type ClassYear = 'freshman' | 'sophomore' | 'junior' | 'senior';

export type LinkStatus = 'ok' | 'dead' | 'error' | 'unchecked';

export interface Compensation {
  /** Lower bound in USD for the stated unit. */
  min: number | null;
  max: number | null;
  unit: 'hour' | 'week' | 'month' | 'year';
  currency: string;
  /** Where the number came from: 'field' = ATS compensation field, 'description' = pay-transparency text. */
  source: 'field' | 'description';
  /** The raw text the number was read from (for the "source" label). */
  raw: string;
}

export interface Eligibility {
  /**
   * Graduation years the posting targets (canonical form).
   * Empty array = the posting does not say (treated as open to everyone).
   */
  gradYears: number[];
  /** Human class-year words found ("rising junior", "sophomore program"). */
  phrases: string[];
  /** Exact snippet the eligibility came from, for the "why" view. */
  evidence: string | null;
}

/** A requirement/skill signal id from src/core/signals.ts. */
export type SignalId = string;

export interface Requirements {
  required: SignalId[];
  preferred: SignalId[];
  /** Minimum GPA if stated ("3.5 GPA or above"). */
  minGpa: number | null;
  /** Normalized majors named as required/preferred (signal ids with the `major:` prefix). */
  majors: SignalId[];
}

export interface Classification {
  industry: IndustryId;
  career: CareerId;
  family: RoleFamily;
  method: 'rules' | 'model';
  /** 0..1 */
  confidence: number;
  /** Short human-readable reasons ("department: Investment Banking"). */
  evidence: string[];
}

/** The normalized posting. One row per live posting per pull. */
export interface Posting {
  /** `${source}:${companySlug}:${externalId}` */
  id: string;
  source: SourceId;
  company: string;
  companySlug: string;
  externalId: string;
  title: string;
  normalizedTitle: string;
  department: string | null;
  locations: string[];
  cities: CityId[];
  remote: boolean;
  postedAt: string | null; // ISO date-time
  updatedAt: string | null; // ISO date-time
  /** Direct link to the employer's own ATS posting. Never an aggregator. */
  applyUrl: string;
  /** Plain text, HTML stripped, capped at ~6000 chars. */
  description: string;
  compensation: Compensation | null;
  firstSeen: string; // ISO date (YYYY-MM-DD)
  lastSeen: string; // ISO date
  linkVerifiedAt: string | null; // ISO date-time
  linkStatus: LinkStatus;
  isInternship: boolean;
  eligibility: Eligibility;
  classification: Classification;
  requirements: Requirements;
  /** Application deadline if stated in the posting. ISO date. */
  deadline: string | null;
  /** Recruiting cycle, e.g. "summer-2027". */
  cycle: string;
  /** company + normalized title + cycle. Survives reposts with new ids. */
  dedupeKey: string;
}

export interface SourceRunResult {
  companySlug: string;
  source: SourceId;
  ok: boolean;
  fetched: number;
  kept: number;
  error: string | null;
}

/** A dated snapshot file in public/data/snapshots/YYYY-MM-DD.json */
export interface Snapshot {
  schemaVersion: 1;
  dataset: 'live' | 'demo';
  pulledAt: string; // ISO date-time
  date: string; // YYYY-MM-DD
  /** First date this dataset has data for ("Tracking since"). */
  trackingSince: string;
  sources: SourceRunResult[];
  postings: Posting[];
}

/**
 * Aggregated history built from every snapshot. This is the
 * "Last Intern Cycle" dataset: every day pulled is next year's data.
 */
export interface HistoryFile {
  schemaVersion: 1;
  dataset: 'live' | 'demo';
  trackingSince: string;
  builtAt: string;
  /** One row per company + normalized title + cycle. */
  roles: HistoryRole[];
  /** Daily count of live internship postings per industry. */
  volume: { date: string; industry: IndustryId; open: number; opened: number }[];
}

export interface HistoryRole {
  dedupeKey: string;
  companySlug: string;
  company: string;
  normalizedTitle: string;
  title: string;
  industry: IndustryId;
  career: CareerId;
  cycle: string;
  /** First day seen live (or the ATS posted date when earlier and known). */
  opened: string;
  /** Last day seen live; null when still open at the latest pull. */
  closed: string | null;
  compensation: Compensation | null;
}

export interface CompanySeed {
  slug: string;
  name: string;
  source: Exclude<SourceId, 'demo'>;
  /** Board token (Greenhouse), site slug (Lever) or org (Ashby). */
  token: string;
  /** Industry hint used when posting text is ambiguous. */
  industry: IndustryId;
  /** Official careers page (for documentation only). */
  careersUrl?: string;
}

// ---------- User side ----------

export interface Profile {
  name: string | null;
  email: string | null;
  school: string | null;
  majors: SignalId[]; // `major:*` ids
  gpa: number | null;
  gradYear: number | null;
  skills: SignalId[]; // non-major signal ids
  coursework: string[];
  experience: { title: string; org: string | null }[];
  /** Raw text length, for "we read N words". */
  wordCount: number;
}

export interface Targets {
  classYear: ClassYear;
  industries: IndustryId[];
  careers: CareerId[];
  cities: CityId[];
  payFloorHourly: number | null;
}

export type FitTier = 'perfect' | 'almost' | 'weak' | 'nonfit';

export interface FitResult {
  tier: FitTier;
  /** 0..100, ranking inside a tier. */
  score: number;
  eligible: boolean;
  /** true when eligibility could not be read from the posting. */
  eligibilityUnknown: boolean;
  matched: SignalId[];
  missing: SignalId[];
  /** Plain-language reasons for the "why" view. */
  reasons: string[];
  /** The one gap for Almost. */
  gap: string | null;
}

export type JobStatus = 'new' | 'opened' | 'applied';

export type TrackerStage = 'applied' | 'assessment' | 'interview' | 'offer' | 'denied';

export interface TrackerCard {
  postingId: string;
  dedupeKey: string;
  company: string;
  companySlug: string;
  title: string;
  applyUrl: string;
  industry: IndustryId;
  career: CareerId;
  stage: TrackerStage;
  appliedAt: string; // ISO date-time
  notes: string;
  /** Set when the last move came from a forwarded email. */
  movedByEmail: { from: TrackerStage | null; at: string; emailId: string } | null;
  history: { stage: TrackerStage; at: string; by: 'user' | 'email' }[];
}

export type EmailKind =
  | 'applied-confirmation'
  | 'assessment'
  | 'interview'
  | 'offer'
  | 'rejection'
  | 'other';

export interface InboundEmail {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
}

export interface EmailClassification {
  kind: EmailKind;
  confidence: number;
  /** Company name / slug guess from sender domain, signature and subject. */
  companyGuess: string | null;
  /** Role title guess from subject/body. */
  roleGuess: string | null;
  evidence: string[];
}
