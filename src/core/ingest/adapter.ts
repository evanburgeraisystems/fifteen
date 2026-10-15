/**
 * Source adapter contract.
 *
 * An adapter knows ONE public, keyless job-board API. It turns a company seed into raw jobs; everything
 * after that (plain text, internship detection, classification, dedupe keys, link checks) is shared and
 * lives in normalize.ts / verify.ts, so a new source only has to implement `fetchJobs`.
 *
 * KNOWN GAP (stated plainly, also in docs/DATA_PIPELINE.md): Workday, Taleo, iCIMS and Avature power
 * most banks, the Big 4 and big corporates, and they expose NO comparable public, keyless board API
 * (Workday's career-site JSON is tenant-specific and undocumented; Taleo/iCIMS/Avature are
 * session- or HTML-driven). Fifteen therefore covers companies on Greenhouse, Lever and Ashby today.
 * This interface is the seam where a future adapter (a licensed feed, an employer-provided export,
 * a sanctioned scraper) plugs in: implement `SourceAdapter`, add the id to `SourceId` in types.ts,
 * register it in index.ts, and add seed rows.
 */
import type { CompanySeed, Compensation } from '../types.ts';

/** One job exactly as a board describes it, before any classification. */
export interface RawJob {
  /** The board's own id, as a string. Stable for the life of the posting. */
  externalId: string;
  title: string;
  department: string | null;
  /** Free-text locations as the board prints them ("New York, NY", "Remote - USA"). */
  locations: string[];
  /** The board itself says remote (workplace type / remote flag / "Remote" in a location). */
  remoteHint: boolean;
  /** ISO date-time the job was first published, when the board says. */
  postedAt: string | null;
  /** ISO date-time of the last edit, when the board says. */
  updatedAt: string | null;
  /** The employer's own ATS posting page. Never an aggregator. */
  applyUrl: string;
  /** Description as HTML (entity-decoded: real tags, ready for htmlToText). */
  descriptionHtml: string;
  /** Structured pay from the ATS, or null. Pay found in free text is handled in normalize.ts. */
  compensation: Compensation | null;
}

export interface SourceAdapter {
  source: 'greenhouse' | 'lever' | 'ashby';
  /** Fetch every currently-open job on the company's board. Throws on HTTP/shape failure. */
  fetchJobs(seed: CompanySeed, fetchImpl: typeof fetch): Promise<RawJob[]>;
}
