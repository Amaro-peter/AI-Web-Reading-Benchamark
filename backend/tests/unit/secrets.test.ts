import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import { collectSecrets, redactSecrets } from '../../src/config/secrets.js';

describe('collectSecrets', () => {
  it('collects every configured credential', () => {
    const env = loadEnv({
      GEMINI_API_KEY: 'gemini-key-value',
      OPENAI_API_KEY: 'openai-key-value',
      ANTHROPIC_API_KEY: 'anthropic-key-value',
    });
    expect(collectSecrets(env)).toEqual([
      'gemini-key-value',
      'openai-key-value',
      'anthropic-key-value',
    ]);
  });

  it('returns nothing when no credential is configured', () => {
    expect(collectSecrets(loadEnv({}))).toEqual([]);
  });

  it('skips a credential too short to redact safely', () => {
    // A 7-character "secret" would match ordinary words and redact real text.
    expect(collectSecrets(loadEnv({ GEMINI_API_KEY: 'abcdefg' }))).toEqual([]);
  });

  it('keeps a credential of exactly the minimum length', () => {
    expect(collectSecrets(loadEnv({ GEMINI_API_KEY: 'abcdefgh' }))).toEqual(['abcdefgh']);
  });

  it('collects only the providers that are configured', () => {
    const env = loadEnv({ OPENAI_API_KEY: 'openai-key-value' });
    expect(collectSecrets(env)).toEqual(['openai-key-value']);
  });
});

describe('redactSecrets', () => {
  it('replaces a secret wherever it appears', () => {
    expect(redactSecrets('key=abc123xyz failed', ['abc123xyz'])).toBe('key=[redacted] failed');
  });

  it('replaces every occurrence, not just the first', () => {
    expect(redactSecrets('abc123xyz and abc123xyz', ['abc123xyz'])).toBe(
      '[redacted] and [redacted]',
    );
  });

  it('replaces each of several secrets', () => {
    expect(redactSecrets('a=one-secret b=two-secret', ['one-secret', 'two-secret'])).toBe(
      'a=[redacted] b=[redacted]',
    );
  });

  it('leaves text untouched when there is nothing to redact', () => {
    expect(redactSecrets('nothing sensitive here', [])).toBe('nothing sensitive here');
    expect(redactSecrets('nothing sensitive here', ['absent-value'])).toBe(
      'nothing sensitive here',
    );
  });

  it('uses a placeholder that cannot be mistaken for the value', () => {
    expect(redactSecrets('abc123xyz', ['abc123xyz'])).toBe('[redacted]');
  });

  it('handles an empty input string', () => {
    expect(redactSecrets('', ['abc123xyz'])).toBe('');
  });
});
