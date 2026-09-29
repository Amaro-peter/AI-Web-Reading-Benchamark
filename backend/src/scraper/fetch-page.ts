import { ScrapeError } from '../domain/errors.js';
import { assertSafeUrl, type LookupFn } from './ssrf.js';
import { parseTargetUrl } from './url-validation.js';

/** Content types we are willing to parse as a web page. */
const ALLOWED_CONTENT_TYPES = ['text/html', 'application/xhtml+xml'];

/** Statuses that carry a Location header we may follow. */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const USER_AGENT =
  'AIWebReadingBenchmark/0.1 (+https://github.com/Amaro-peter/AI-Web-Reading-Benchamark)';

interface FetchPageOptions {
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
}

export interface FetchPageDeps {
  fetchImpl?: typeof fetch;
  lookup?: LookupFn;
  /** Hostnames exempted from the private-address guard. Empty by default. */
  allowedHosts?: readonly string[];
}

interface FetchedPage {
  /** The URL the caller asked for. */
  requestedUrl: string;
  /** The URL the content actually came from, after redirects. */
  finalUrl: string;
  html: string;
  contentType: string;
  bytes: number;
}

/**
 * Fetches a page under a strict budget.
 *
 * Redirects are followed manually so that every hop is re-validated: a server
 * that answers with `Location: http://169.254.169.254/` must not be able to
 * walk us into the private network. `redirect: 'manual'` is what makes that
 * possible — letting the runtime follow redirects would skip the check.
 */
export async function fetchPage(
  target: URL,
  options: FetchPageOptions,
  deps: FetchPageDeps = {},
): Promise<FetchedPage> {
  const doFetch = deps.fetchImpl ?? fetch;
  const lookup = deps.lookup;
  const allowedHosts = deps.allowedHosts ?? [];
  const deadline = Date.now() + options.timeoutMs;

  let current = target;
  let hops = 0;

  for (;;) {
    await assertSafeUrl(current, lookup, allowedHosts);

    const response = await performRequest(doFetch, current, deadline);

    if (REDIRECT_STATUSES.has(response.status)) {
      if (hops >= options.maxRedirects) {
        throw new ScrapeError('TOO_MANY_REDIRECTS', 'That URL redirected too many times.');
      }

      const location = response.headers.get('location');
      if (location === null || location.trim() === '') {
        throw new ScrapeError('HTTP_ERROR', 'The page redirected without a destination.');
      }

      current = resolveRedirect(location, current);
      hops += 1;
      continue;
    }

    if (!response.ok) {
      throw new ScrapeError('HTTP_ERROR', `The page responded with HTTP ${response.status}.`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    assertHtmlContentType(contentType);
    assertDeclaredSizeWithinBudget(response.headers.get('content-length'), options.maxBytes);

    const { text, bytes } = await readBodyWithLimit(response, options.maxBytes);

    return {
      requestedUrl: target.toString(),
      finalUrl: current.toString(),
      html: text,
      contentType,
      bytes,
    };
  }
}

async function performRequest(
  doFetch: typeof fetch,
  url: URL,
  deadline: number,
): Promise<Response> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new ScrapeError('TIMEOUT', 'The page took too long to respond.');
  }

  try {
    return await doFetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(remaining),
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': USER_AGENT,
      },
    });
  } catch (error) {
    throw toTransportError(error);
  }
}

/** Resolves a Location header and re-applies the full URL policy to it. */
function resolveRedirect(location: string, from: URL): URL {
  let resolved: string;
  try {
    resolved = new URL(location, from).toString();
  } catch {
    throw new ScrapeError('HTTP_ERROR', 'The page redirected to an invalid destination.');
  }
  return parseTargetUrl(resolved);
}

function assertHtmlContentType(contentType: string): void {
  const essence = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (!ALLOWED_CONTENT_TYPES.includes(essence)) {
    throw new ScrapeError('UNSUPPORTED_CONTENT_TYPE', 'That URL does not serve an HTML page.');
  }
}

function assertDeclaredSizeWithinBudget(header: string | null, maxBytes: number): void {
  if (header === null) {
    return;
  }
  const declared = Number(header);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ScrapeError('RESPONSE_TOO_LARGE', 'That page is larger than this service will read.');
  }
}

/**
 * Reads the body while counting bytes, aborting as soon as the budget is
 * exceeded. Buffering first and checking afterwards would defeat the point.
 */
async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; bytes: number }> {
  const body = response.body;

  if (body === null) {
    return { text: '', bytes: 0 };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  const chunks: string[] = [];
  let bytes = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        throw new ScrapeError(
          'RESPONSE_TOO_LARGE',
          'That page is larger than this service will read.',
        );
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
  } catch (error) {
    throw error instanceof ScrapeError ? error : toTransportError(error);
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  chunks.push(decoder.decode());
  return { text: chunks.join(''), bytes };
}

function toTransportError(error: unknown): ScrapeError {
  if (error instanceof ScrapeError) {
    return error;
  }
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return new ScrapeError('TIMEOUT', 'The page took too long to respond.');
  }
  return new ScrapeError('FETCH_FAILED', 'That page could not be fetched.');
}
