/**
 * Posting classification (rules first). OWNER: classify agent.
 * Signatures are a contract used by src/core/ingest/normalize.ts and the demo generator.
 * Implementations live in the sibling files; this module is the stable surface.
 */
export type { RoleText } from './career.ts';
export { classifyRole } from './career.ts';
export { htmlToText } from './html.ts';
export { detectInternship } from './internship.ts';
export { extractEligibility } from './eligibility.ts';
export { extractRequirements } from './requirements.ts';
export { extractCompensationFromText } from './compensation.ts';
export { extractDeadline } from './deadline.ts';
export { matchCities } from './cities.ts';
