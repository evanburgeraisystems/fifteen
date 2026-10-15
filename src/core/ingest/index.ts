import type { CompanySeed } from '../types.ts';
import type { SourceAdapter } from './adapter.ts';
import { ashbyAdapter } from './ashby.ts';
import { greenhouseAdapter } from './greenhouse.ts';
import { leverAdapter } from './lever.ts';

export type { RawJob, SourceAdapter } from './adapter.ts';

/** Every supported source. A new adapter (see the known-gap note in adapter.ts) is registered here. */
export const ADAPTERS: Record<CompanySeed['source'], SourceAdapter> = {
  greenhouse: greenhouseAdapter,
  lever: leverAdapter,
  ashby: ashbyAdapter,
};

export { normalizeJob } from './normalize.ts';
export { verifyLinks } from './verify.ts';
export { buildHistory, writeSnapshotFiles } from './snapshot.ts';
