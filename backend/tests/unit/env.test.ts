import { describe, expect, it } from 'vitest';
import { apiKeyFor, apiKeyVariableFor, loadEnv, PROVIDER_IDS } from '../../src/config/env.js';

describe('loadEnv defaults', () => {
  it('applies defaults when nothing is configured', () => {
    const env = loadEnv({});
    expect(env.PORT).toBe(3001);
    expect(env.HOST).toBe('0.0.0.0');
    expect(env.NODE_ENV).toBe('development');
    expect(env.FRONTEND_URL).toBe('http://localhost:3000');
    expect(env.AI_PROVIDER_MODE).toBe('real');
  });

  it('coerces numeric variables from strings', () => {
    const env = loadEnv({ PORT: '8080', SCRAPER_TIMEOUT_MS: '2500' });
    expect(env.PORT).toBe(8080);
    expect(env.SCRAPER_TIMEOUT_MS).toBe(2500);
  });

  it('falls back to the default when a numeric variable is present but empty', () => {
    const env = loadEnv({ PORT: '', MAX_CONTENT_CHARS: '   ' });
    expect(env.PORT).toBe(3001);
    expect(env.MAX_CONTENT_CHARS).toBe(12_000);
  });
});

describe('loadEnv validation', () => {
  it.each([
    ['PORT', { PORT: 'not-a-number' }],
    ['PORT', { PORT: '0' }],
    ['PORT', { PORT: '-1' }],
    ['FRONTEND_URL', { FRONTEND_URL: 'not-a-url' }],
    ['NODE_ENV', { NODE_ENV: 'staging' }],
    ['AI_PROVIDER_MODE', { AI_PROVIDER_MODE: 'live' }],
  ])('rejects an invalid %s', (_name, source) => {
    expect(() => loadEnv(source)).toThrow(/Invalid environment configuration/);
  });

  it('names the offending variable without echoing its value', () => {
    const secretish = 'sk-do-not-leak-this-value';
    try {
      loadEnv({ FRONTEND_URL: secretish });
      throw new Error('expected loadEnv to throw');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('FRONTEND_URL');
      expect(message).not.toContain(secretish);
    }
  });
});

describe('provider credentials', () => {
  it('treats an empty key as "not configured"', () => {
    const env = loadEnv({ GEMINI_API_KEY: '', OPENAI_API_KEY: '   ' });
    expect(apiKeyFor(env, 'gemini')).toBeUndefined();
    expect(apiKeyFor(env, 'openai')).toBeUndefined();
  });

  it('reads a configured key and trims it', () => {
    const env = loadEnv({ ANTHROPIC_API_KEY: '  sk-ant-test  ' });
    expect(apiKeyFor(env, 'claude')).toBe('sk-ant-test');
  });

  it.each([
    ['gemini', 'GEMINI_API_KEY'],
    ['openai', 'OPENAI_API_KEY'],
    ['claude', 'ANTHROPIC_API_KEY'],
  ] as const)('maps %s to %s', (provider, variable) => {
    expect(apiKeyVariableFor(provider)).toBe(variable);
  });

  it('covers every known provider', () => {
    expect(PROVIDER_IDS).toEqual(['gemini', 'openai', 'claude']);
  });
});
