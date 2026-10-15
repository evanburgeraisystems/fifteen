/**
 * Rules first, model second. Postings the rules classified with low confidence
 * go through the configured ModelProvider; its answer is kept only when it is
 * more confident. With the default mock provider this is a no-op, so pulls
 * stay deterministic and offline-capable.
 */
import type { ModelProvider } from '../provider/index.ts';
import type { Posting } from '../types.ts';

export const MODEL_THRESHOLD = 0.5;

export async function refineWithModel(postings: Posting[], provider: ModelProvider, threshold = MODEL_THRESHOLD): Promise<number> {
  let changed = 0;
  for (const p of postings) {
    if (p.classification.confidence >= threshold) continue;
    const r = await provider.classifyRole({
      title: p.title,
      department: p.department,
      description: p.description,
      companyIndustry: p.classification.industry,
    });
    if (!r || r.confidence <= p.classification.confidence) continue;
    p.classification = {
      ...r,
      method: provider.name === 'mock' ? 'rules' : 'model',
      evidence: [...r.evidence, `${provider.name} fallback (rules confidence ${p.classification.confidence.toFixed(2)})`],
    };
    changed++;
  }
  return changed;
}
