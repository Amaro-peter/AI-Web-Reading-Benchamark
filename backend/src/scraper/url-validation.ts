import { ScrapeError } from '../domain/errors.js';

/**
 * Upper bound on the URL a caller may submit. Long URLs are the cheap half of
 * several parser-confusion tricks, and no legitimate article needs one.
 */
export const MAX_URL_LENGTH = 2048;

/** The only schemes this service will ever fetch. */
export const ALLOWED_PROTOCOLS = ['http:', 'https:'] as const;

/**
 * Parses and structurally validates a user-supplied URL.
 *
 * This is the first of two gates: it rejects anything that is not a
 * credential-free absolute HTTP(S) URL. The second gate (see `ssrf.ts`)
 * decides whether the host is one we are allowed to reach.
 */
export function parseTargetUrl(input: unknown): URL {
  if (typeof input !== 'string') {
    throw new ScrapeError('INVALID_URL', 'A URL string is required.');
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    throw new ScrapeError('INVALID_URL', 'A URL is required.');
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    throw new ScrapeError(
      'INVALID_URL',
      `The URL is longer than the ${MAX_URL_LENGTH} character limit.`,
    );
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ScrapeError('INVALID_URL', 'That is not a valid absolute URL.');
  }

  if (!isAllowedProtocol(url.protocol)) {
    throw new ScrapeError('UNSUPPORTED_SCHEME', 'Only http:// and https:// URLs are supported.');
  }

  // `new URL('http://')` throws, but some inputs still land here with no host.
  if (url.hostname.length === 0) {
    throw new ScrapeError('INVALID_URL', 'The URL has no host.');
  }

  // `https://evil.com@127.0.0.1/` reads as evil.com to a human and as
  // 127.0.0.1 to the fetcher. Refuse the ambiguity outright.
  if (url.username !== '' || url.password !== '') {
    throw new ScrapeError('INVALID_URL', 'URLs with embedded credentials are not supported.');
  }

  return url;
}

function isAllowedProtocol(protocol: string): boolean {
  return (ALLOWED_PROTOCOLS as readonly string[]).includes(protocol);
}
