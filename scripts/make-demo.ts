/**
 * Writes the deterministic DEMO dataset (fictional companies, clearly labeled
 * `dataset: 'demo'`) used for offline dev, Playwright journeys and the
 * performance test.
 *
 *   npm run demo-data
 *
 * Output: public/data/demo/{latest,history,index}.json and
 *         public/data/demo-zero/{latest,history,index}.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, hashFiles, renderFiles } from './demo/generate.ts';

const root = fileURLToPath(new URL('../public/data/', import.meta.url));

const out = generate();
const files = renderFiles(out);
for (const [rel, content] of Object.entries(files)) {
  const path = `${root}${rel}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
  console.info(`wrote public/data/${rel} (${(Buffer.byteLength(content) / 1024).toFixed(0)} KB)`);
}
console.info(`demo dataset hash ${hashFiles(files).slice(0, 16)}`);
