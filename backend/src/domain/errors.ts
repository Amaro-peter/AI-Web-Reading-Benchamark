/**
 * Machine-readable failure codes returned to the client.
 *
 * They are deliberately coarse: a caller controls the URL, so an error message
 * must never leak details about the backend's own network position.
 */
export const SCRAPE_ERROR_CODES = [
  'INVALID_URL',
  'UNSUPPORTED_SCHEME',
  'BLOCKED_HOST',
  'DNS_FAILURE',
  'HTTP_ERROR',
  'UNSUPPORTED_CONTENT_TYPE',
  'RESPONSE_TOO_LARGE',
  'TIMEOUT',
  'TOO_MANY_REDIRECTS',
  'FETCH_FAILED',
  'EMPTY_CONTENT',
] as const;

export type ScrapeErrorCode = (typeof SCRAPE_ERROR_CODES)[number];

/** An expected, client-facing scraping failure. */
export class ScrapeError extends Error {
  readonly code: ScrapeErrorCode;

  constructor(code: ScrapeErrorCode, message: string) {
    super(message);
    this.name = 'ScrapeError';
    this.code = code;
  }
}

/** True when `value` is a ScrapeError, without relying on instanceof across realms. */
export function isScrapeError(value: unknown): value is ScrapeError {
  return value instanceof ScrapeError;
}

/** HTTP status to answer with for each scraping failure. */
export function statusForScrapeError(code: ScrapeErrorCode): number {
  switch (code) {
    case 'INVALID_URL':
    case 'UNSUPPORTED_SCHEME':
    case 'BLOCKED_HOST':
      return 400;
    case 'TIMEOUT':
      return 504;
    case 'RESPONSE_TOO_LARGE':
      return 413;
    default:
      return 502;
  }
}
