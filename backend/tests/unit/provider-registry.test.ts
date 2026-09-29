import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import { DEFAULT_MODELS, modelConfigFor, modelVariableFor } from '../../src/config/models.js';
import { createProviders } from '../../src/providers/registry.js';
import { isAvailable } from '../../src/providers/types.js';

describe('createProviders with no credentials', () => {
  const providers = createProviders(loadEnv({}));

  it('returns an entry for every known provider', () => {
    expect(providers.map((p) => p.id)).toEqual(['gemini', 'openai', 'claude']);
  });

  it('marks each one unavailable instead of throwing', () => {
    expect(providers.every((p) => p.status === 'unavailable')).toBe(true);
  });

  it('says which variable would enable it', () => {
    const reasons = providers.map((p) => (p.status === 'unavailable' ? p.reason : ''));
    expect(reasons).toEqual([
      'GEMINI_API_KEY is not configured.',
      'OPENAI_API_KEY is not configured.',
      'ANTHROPIC_API_KEY is not configured.',
    ]);
  });

  it('still reports the model that would have been used', () => {
    expect(providers.map((p) => p.model)).toEqual([
      DEFAULT_MODELS.gemini.model,
      DEFAULT_MODELS.openai.model,
      DEFAULT_MODELS.claude.model,
    ]);
  });
});

describe('createProviders with partial credentials', () => {
  const providers = createProviders(loadEnv({ OPENAI_API_KEY: 'sk-test' }));

  it('enables only the configured provider', () => {
    expect(providers.filter(isAvailable).map((p) => p.id)).toEqual(['openai']);
  });

  it('leaves the others unavailable rather than failing the whole line-up', () => {
    expect(providers.filter((p) => p.status === 'unavailable').map((p) => p.id)).toEqual([
      'gemini',
      'claude',
    ]);
  });

  it('builds a provider whose name and model match the registry entry', () => {
    const openai = providers.find((p) => p.id === 'openai');
    expect(openai && isAvailable(openai) && openai.provider.name).toBe('openai');
    expect(openai && isAvailable(openai) && openai.provider.model).toBe(
      DEFAULT_MODELS.openai.model,
    );
  });
});

describe('createProviders in mock mode', () => {
  const providers = createProviders(loadEnv({ AI_PROVIDER_MODE: 'mock' }));

  it('enables all three without any credential', () => {
    expect(providers.every(isAvailable)).toBe(true);
  });

  it('is unaffected by credentials that happen to be present', () => {
    const withKeys = createProviders(
      loadEnv({ AI_PROVIDER_MODE: 'mock', OPENAI_API_KEY: 'sk-test' }),
    );
    expect(withKeys.every(isAvailable)).toBe(true);
  });
});

describe('model configuration', () => {
  it('uses the central default when nothing is overridden', () => {
    expect(modelConfigFor(loadEnv({}), 'claude').model).toBe(DEFAULT_MODELS.claude.model);
  });

  it.each([
    ['gemini', 'GEMINI_MODEL'],
    ['openai', 'OPENAI_MODEL'],
    ['claude', 'ANTHROPIC_MODEL'],
  ] as const)('lets %s be overridden through %s', (provider, variable) => {
    expect(modelVariableFor(provider)).toBe(variable);
    const env = loadEnv({ [variable]: 'pinned-model' });
    expect(modelConfigFor(env, provider).model).toBe('pinned-model');
  });

  it('keeps the label when the model is overridden', () => {
    const env = loadEnv({ OPENAI_MODEL: 'pinned' });
    expect(modelConfigFor(env, 'openai').label).toBe('ChatGPT');
  });

  it('presents openai as ChatGPT in the UI', () => {
    expect(DEFAULT_MODELS.openai.label).toBe('ChatGPT');
    expect(DEFAULT_MODELS.gemini.label).toBe('Gemini');
    expect(DEFAULT_MODELS.claude.label).toBe('Claude');
  });
});
