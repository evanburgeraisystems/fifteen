/**
 * One model-provider interface for every "model second" call
 * (role classification fallback, email stage, resume profile).
 *
 * Configured by env vars:
 *   FIFTEEN_MODEL_PROVIDER = mock (default) | http
 *   FIFTEEN_MODEL_ENDPOINT = URL that accepts POST {task, input} and returns JSON
 * The mock provider is deterministic and offline, so the app and tests run with no keys.
 */
import type { Classification, EmailClassification, InboundEmail, Profile } from '../types.ts';
import type { RoleText } from '../classify/index.ts';

export interface ModelProvider {
  readonly name: string;
  classifyRole(input: RoleText): Promise<Classification | null>;
  classifyEmail(email: InboundEmail): Promise<EmailClassification | null>;
  extractProfile(text: string, nowIso: string): Promise<Partial<Profile> | null>;
}

export type ProviderEnv = Record<string, string | undefined>;
