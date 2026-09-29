import { describe, expect, it } from 'vitest';
import { ScrapeError } from '../../src/domain/errors.js';
import { parseTargetUrl } from '../../src/scraper/url-validation.js';

function failure(input: unknown): ScrapeError {
  try {
    parseTargetUrl(input);
  } catch (error) {
    return error as ScrapeError;
  }
  throw new Error('expected parseTargetUrl to throw');
}

describe('input that is not a string', () => {
  it.each([null, undefined, 123, {}, [], true, Symbol('x')])('rejects %s', (input) => {
    const error = failure(input);
    expect(error.code).toBe('INVALID_URL');
    expect(error.message).toBe('A URL string is required.');
  });
});

describe('whitespace handling', () => {
  it('accepts a URL padded with whitespace and returns it trimmed', () => {
    expect(parseTargetUrl('  https://example.com/a  ').toString()).toBe('https://example.com/a');
  });

  it.each(['\thttps://example.com/', '\nhttps://example.com/', ' \r\n https://example.com/ '])(
    'accepts %j',
    (input) => {
      expect(parseTargetUrl(input).hostname).toBe('example.com');
    },
  );

  it('distinguishes an empty URL from a malformed one', () => {
    expect(failure('').message).toBe('A URL is required.');
    expect(failure('   ').message).toBe('A URL is required.');
    expect(failure('nonsense').message).toBe('That is not a valid absolute URL.');
  });
});

describe('the length limit', () => {
  const prefix = 'https://example.com/';

  function urlOfLength(length: number): string {
    return prefix + 'a'.repeat(length - prefix.length);
  }

  it('accepts a URL of exactly the maximum length', () => {
    const url = urlOfLength(2048);
    expect(url).toHaveLength(2048);
    expect(() => parseTargetUrl(url)).not.toThrow();
  });

  it('rejects a URL one character over the maximum', () => {
    const url = urlOfLength(2049);
    expect(url).toHaveLength(2049);
    const error = failure(url);
    expect(error.code).toBe('INVALID_URL');
    expect(error.message).toContain('2048');
  });

  it('measures the length after trimming, not before', () => {
    const padded = `   ${urlOfLength(2048)}   `;
    expect(padded.length).toBeGreaterThan(2048);
    expect(() => parseTargetUrl(padded)).not.toThrow();
  });
});

describe('error messages are specific enough to act on', () => {
  it.each([
    ['ftp://example.com/', 'Only http:// and https:// URLs are supported.'],
    ['https://user:pw@example.com/', 'URLs with embedded credentials are not supported.'],
  ])('%s reports: %s', (input, message) => {
    expect(failure(input).message).toBe(message);
  });

  it('rejects a URL with only a username and no password', () => {
    expect(failure('https://user@example.com/').code).toBe('INVALID_URL');
  });

  it('rejects a URL with only a password', () => {
    expect(failure('https://:pw@example.com/').code).toBe('INVALID_URL');
  });

  it('accepts a URL with no credentials at all', () => {
    const url = parseTargetUrl('https://example.com/');
    expect(url.username).toBe('');
    expect(url.password).toBe('');
  });
});
