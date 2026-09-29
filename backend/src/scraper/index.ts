import type { Env } from '../config/env.js';
import { extractContent, type ExtractedPage } from './extract.js';
import { fetchPage, type FetchPageDeps } from './fetch-page.js';
import { parseTargetUrl } from './url-validation.js';

interface ScrapeOptions {
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
  maxChars: number;
  /** Hostnames exempted from the private-address guard. Empty by default. */
  allowedHosts: readonly string[];
}

export interface ScrapedPage extends ExtractedPage {
  requestedUrl: string;
  finalUrl: string;
  bytes: number;
}

const DEFAULT_MAX_REDIRECTS = 5;

export function scrapeOptionsFromEnv(env: Env): ScrapeOptions {
  return {
    timeoutMs: env.SCRAPER_TIMEOUT_MS,
    maxBytes: env.SCRAPER_MAX_BYTES,
    maxRedirects: DEFAULT_MAX_REDIRECTS,
    maxChars: env.MAX_CONTENT_CHARS,
    allowedHosts: env.SCRAPER_ALLOWED_HOSTS,
  };
}

/**
 * validate -> fetch (guarded) -> extract.
 *
 * Every failure along the way surfaces as a ScrapeError with a code the HTTP
 * layer maps to a status, so the route itself contains no error taxonomy.
 */
export async function scrapePage(
  rawUrl: string,
  options: ScrapeOptions,
  deps: FetchPageDeps = {},
): Promise<ScrapedPage> {
  const target = parseTargetUrl(rawUrl);

  const fetched = await fetchPage(
    target,
    {
      timeoutMs: options.timeoutMs,
      maxBytes: options.maxBytes,
      maxRedirects: options.maxRedirects,
    },
    { allowedHosts: options.allowedHosts, ...deps },
  );

  const extracted = extractContent(fetched.html, fetched.finalUrl, {
    maxChars: options.maxChars,
  });

  return {
    ...extracted,
    requestedUrl: fetched.requestedUrl,
    finalUrl: fetched.finalUrl,
    bytes: fetched.bytes,
  };
}
