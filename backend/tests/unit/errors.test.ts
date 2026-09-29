import { describe, expect, it } from 'vitest';
import {
  isScrapeError,
  SCRAPE_ERROR_CODES,
  ScrapeError,
  statusForScrapeError,
} from '../../src/domain/errors.js';

describe('ScrapeError', () => {
  it('carries its code and message', () => {
    const error = new ScrapeError('TIMEOUT', 'too slow');
    expect(error.code).toBe('TIMEOUT');
    expect(error.message).toBe('too slow');
    expect(error.name).toBe('ScrapeError');
    expect(error).toBeInstanceOf(Error);
  });

  it('is recognised by the type guard', () => {
    expect(isScrapeError(new ScrapeError('INVALID_URL', 'x'))).toBe(true);
    expect(isScrapeError(new Error('x'))).toBe(false);
    expect(isScrapeError(null)).toBe(false);
    expect(isScrapeError({ code: 'INVALID_URL' })).toBe(false);
  });
});

describe('statusForScrapeError', () => {
  it.each([
    ['INVALID_URL', 400],
    ['UNSUPPORTED_SCHEME', 400],
    ['BLOCKED_HOST', 400],
    ['TIMEOUT', 504],
    ['RESPONSE_TOO_LARGE', 413],
    ['DNS_FAILURE', 502],
    ['HTTP_ERROR', 502],
    ['UNSUPPORTED_CONTENT_TYPE', 502],
    ['TOO_MANY_REDIRECTS', 502],
    ['FETCH_FAILED', 502],
    ['EMPTY_CONTENT', 502],
  ] as const)('maps %s to HTTP %i', (code, status) => {
    expect(statusForScrapeError(code)).toBe(status);
  });

  it('has a mapping for every declared code', () => {
    for (const code of SCRAPE_ERROR_CODES) {
      expect(statusForScrapeError(code)).toBeGreaterThanOrEqual(400);
    }
  });
});
