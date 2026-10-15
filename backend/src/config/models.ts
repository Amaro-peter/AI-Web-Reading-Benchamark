import type { Env, ProviderId } from './env.js';

export type ModelTier = 'flagship' | 'fast' | 'custom';

/**
 * Centralised model configuration.
 *
 * Every model id the service can talk to is declared here and nowhere else,
 * so switching a model is a one-line change and the API can report exactly
 * which model produced an answer.
 */
interface ModelConfig {
  /** Label shown in the UI. "openai" is presented as "ChatGPT". */
  label: string;
  model: string;
  /** Upper bound on answer length. Answers are one short sentence. */
  maxOutputTokens: number;
  /** Capability tier: allows readers to distinguish flagship vs fast models. */
  tier: ModelTier;
}

export const DEFAULT_MODELS: Record<ProviderId, ModelConfig> = {
  gemini: { label: 'Gemini', model: 'gemini-2.5-pro', maxOutputTokens: 1024, tier: 'flagship' },
  openai: { label: 'ChatGPT', model: 'gpt-4o-mini', maxOutputTokens: 1024, tier: 'fast' },
  claude: {
    label: 'Claude',
    model: 'claude-haiku-4-5-20251001',
    maxOutputTokens: 2048,
    tier: 'fast',
  },
};

const MODEL_OVERRIDE: Record<ProviderId, keyof Env> = {
  gemini: 'GEMINI_MODEL',
  openai: 'OPENAI_MODEL',
  claude: 'ANTHROPIC_MODEL',
};

function tierForModel(modelName: string): ModelTier {
  const lower = modelName.toLowerCase();
  if (lower.includes('mini') || lower.includes('flash') || lower.includes('haiku')) {
    return 'fast';
  }
  if (
    lower.includes('pro') ||
    (lower.includes('gpt-4o') && !lower.includes('mini')) ||
    lower.includes('sonnet') ||
    lower.includes('opus')
  ) {
    return 'flagship';
  }
  return 'custom';
}

/** Resolves the model configuration for a provider, applying any env override. */
export function modelConfigFor(env: Env, provider: ProviderId): ModelConfig {
  const base = DEFAULT_MODELS[provider];
  const override = env[MODEL_OVERRIDE[provider]];

  if (typeof override === 'string' && override.length > 0) {
    return { ...base, model: override, tier: tierForModel(override) };
  }
  return base;
}

/** Name of the environment variable that overrides a provider's model. */
export function modelVariableFor(provider: ProviderId): string {
  return MODEL_OVERRIDE[provider];
}
