import {
  apiKeyFor,
  apiKeyVariableFor,
  PROVIDER_IDS,
  type Env,
  type ProviderId,
} from '../config/env.js';
import { modelConfigFor } from '../config/models.js';
import { ClaudeProvider } from './claude.js';
import { GeminiProvider } from './gemini.js';
import { MockProvider } from './mock.js';
import { OpenAIProvider } from './openai.js';
import type { AIProvider, RegisteredProvider } from './types.js';

/**
 * Builds the provider line-up for a run.
 *
 * A provider with no credential is reported as `unavailable` and carries the
 * name of the variable that would enable it. It never throws: one missing key
 * must not stop the benchmark from running with the other two.
 */
export function createProviders(env: Env): RegisteredProvider[] {
  return PROVIDER_IDS.map((id) => createProvider(env, id));
}

function createProvider(env: Env, id: ProviderId): RegisteredProvider {
  const config = modelConfigFor(env, id);
  const base = { id, label: config.label, model: config.model };

  if (env.AI_PROVIDER_MODE === 'mock') {
    return {
      ...base,
      status: 'ok',
      provider: new MockProvider({ name: id, model: config.model }),
    };
  }

  const apiKey = apiKeyFor(env, id);

  if (apiKey === undefined) {
    return {
      ...base,
      status: 'unavailable',
      reason: `${apiKeyVariableFor(id)} is not configured.`,
    };
  }

  const options = {
    apiKey,
    model: config.model,
    maxOutputTokens: config.maxOutputTokens,
    timeoutMs: env.PROVIDER_TIMEOUT_MS,
  };

  const provider: AIProvider =
    id === 'gemini'
      ? new GeminiProvider(options)
      : id === 'openai'
        ? new OpenAIProvider(options)
        : new ClaudeProvider(options);

  return { ...base, status: 'ok', provider };
}
