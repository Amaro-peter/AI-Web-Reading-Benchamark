import type { Env, ProviderId } from './env.js';

/**
 * Centralised model configuration.
 *
 * Every model id the service can talk to is declared here and nowhere else,
 * so switching a model is a one-line change and the API can report exactly
 * which model produced an answer.
 *
 * The defaults are NOT matched for capability tier — a flagship model and a
 * fast model will not produce comparable results. Override them per provider
 * to run a fair comparison; the API echoes the model actually used with every
 * result so a reader can see what was compared.
 */
interface ModelConfig {
  /** Label shown in the UI. "openai" is presented as "ChatGPT". */
  label: string;
  model: string;
  /** Upper bound on answer length. Answers are one short sentence. */
  maxOutputTokens: number;
}

export const DEFAULT_MODELS: Record<ProviderId, ModelConfig> = {
  gemini: { label: 'Gemini', model: 'gemini-2.5-pro', maxOutputTokens: 1024 },
  openai: { label: 'ChatGPT', model: 'gpt-4o', maxOutputTokens: 1024 },
  claude: { label: 'Claude', model: 'claude-opus-5', maxOutputTokens: 2048 },
};

const MODEL_OVERRIDE: Record<ProviderId, keyof Env> = {
  gemini: 'GEMINI_MODEL',
  openai: 'OPENAI_MODEL',
  claude: 'ANTHROPIC_MODEL',
};

/** Resolves the model configuration for a provider, applying any env override. */
export function modelConfigFor(env: Env, provider: ProviderId): ModelConfig {
  const base = DEFAULT_MODELS[provider];
  const override = env[MODEL_OVERRIDE[provider]];

  return typeof override === 'string' && override.length > 0 ? { ...base, model: override } : base;
}

/** Name of the environment variable that overrides a provider's model. */
export function modelVariableFor(provider: ProviderId): string {
  return MODEL_OVERRIDE[provider];
}
