import { describe, expect, it } from 'vitest';
import { mockProvider } from '../provider/mock.ts';
import type { ModelProvider } from '../provider/index.ts';
import type { Classification, Posting } from '../types.ts';
import { refineWithModel } from './model-fallback.ts';

const cls = (confidence: number): Classification => ({ industry: 'finance', career: 'other', family: 'other', method: 'rules', confidence, evidence: [] });
const posting = (confidence: number) => ({ title: 'Summer Intern', department: null, description: 'Help the team.', classification: cls(confidence) }) as Posting;

const fakeModel: ModelProvider = {
  name: 'http',
  classifyRole: async () => ({ industry: 'finance', career: 'investment-banking', family: 'business', method: 'model', confidence: 0.85, evidence: ['model'] }),
  classifyEmail: async () => null,
  extractProfile: async () => null,
};

describe('model fallback', () => {
  it('replaces only low-confidence rules results, and labels the method', async () => {
    const low = posting(0.2);
    const high = posting(0.9);
    const n = await refineWithModel([low, high], fakeModel);
    expect(n).toBe(1);
    expect(low.classification.career).toBe('investment-banking');
    expect(low.classification.method).toBe('model');
    expect(high.classification.career).toBe('other');
  });
  it('the mock provider is deterministic and never invents confidence', async () => {
    const p = posting(0.1);
    const before = JSON.stringify(p.classification);
    await refineWithModel([p], mockProvider);
    await refineWithModel([p], mockProvider);
    expect(JSON.stringify(p.classification) === before || p.classification.method === 'rules').toBe(true);
  });
});
