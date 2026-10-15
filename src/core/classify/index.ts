/**
 * Posting classification (rules first). OWNER: classify agent.
 * Stub bodies below are placeholders; the classify agent replaces them.
 * Signatures are a contract used by src/core/ingest/normalize.ts and the demo generator.
 */
import type { CityId, Classification, Compensation, Eligibility, IndustryId, Requirements } from '../types.ts';

export interface RoleText {
  title: string;
  department: string | null;
  description: string;
  /** Industry hint from the company seed list. */
  companyIndustry: IndustryId;
}

/** Strip HTML to readable plain text (keeps list items as lines, decodes entities). */
export function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** true for internships, summer analyst/associate programs, co-ops. false for full-time, new grad, apprenticeships for non-students. */
export function detectInternship(title: string, description: string): boolean {
  void description;
  return /\bintern/i.test(title);
}

/** Class-year eligibility, expressed as graduation years for the given summer. */
export function extractEligibility(title: string, description: string, summerYear: number): Eligibility {
  void title; void description; void summerYear;
  return { gradYears: [], phrases: [], evidence: null };
}

/** Industry + career + family with confidence and evidence. */
export function classifyRole(input: RoleText): Classification {
  return { industry: input.companyIndustry, career: 'other', family: 'other', method: 'rules', confidence: 0, evidence: [] };
}

/** Required vs preferred signals, min GPA, majors. */
export function extractRequirements(description: string): Requirements {
  void description;
  return { required: [], preferred: [], minGpa: null, majors: [] };
}

/** Pay range from pay-transparency text ("$25-$30 per hour"). */
export function extractCompensationFromText(description: string): Compensation | null {
  void description;
  return null;
}

/** "Apply by November 1" / "Applications close 11/01/2026" -> ISO date. */
export function extractDeadline(description: string, referenceIso: string): string | null {
  void description; void referenceIso;
  return null;
}

/** Map raw location strings to city ids + remote flag. */
export function matchCities(locations: string[]): { cities: CityId[]; remote: boolean } {
  void locations;
  return { cities: ['other'], remote: false };
}
