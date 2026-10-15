/**
 * Deterministic offline provider. "Model second" calls return the rules result,
 * so the whole app and every test run with no keys and no network.
 */
import { classifyRole } from '../classify/index.ts';
import { classifyEmail } from '../email/classify.ts';
import { parseProfile } from '../resume/profile.ts';
import type { ModelProvider } from './index.ts';

export const mockProvider: ModelProvider = {
  name: 'mock',
  classifyRole: async (input) => classifyRole(input),
  classifyEmail: async (email) => classifyEmail(email),
  extractProfile: async (text, nowIso) => parseProfile(text, nowIso),
};
