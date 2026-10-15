import type { Env } from '../config/env.js';
import { fetchDynamicPage, type BrowserFetchDeps } from './browser-fetch.js';
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
  /** Force headless browser rendering (Playwright Chromium) */
  renderJs?: boolean;
}

export interface ScrapedPage extends ExtractedPage {
  requestedUrl: string;
  finalUrl: string;
  bytes: number;
  rawHtml?: string;
}

interface ScrapePageDeps extends FetchPageDeps, BrowserFetchDeps {
  disableBrowser?: boolean;
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
 * Detects whether an HTML response is an unrendered JavaScript single-page application
 * (React / Next.js / Vue / Angular / Nuxt) requiring headless browser hydration.
 */
export function isDynamicJsShell(html: string, wordCount: number): boolean {
  const hasSpaRoot =
    /<div[^>]+id=["'](root|__next|app|__nuxt)["'][^>]*>\s*<\/div>/i.test(html) ||
    /<(app-root|react-root)[^>]*>\s*<\/(app-root|react-root)>/i.test(html) ||
    /<noscript>[^<]*enable javascript/i.test(html);

  const hasScriptTags = /<script\b/i.test(html);
  const isMinimalText = wordCount < 30;

  return hasSpaRoot || (hasScriptTags && isMinimalText);
}

/**
 * validate -> fetch (guarded) -> extract.
 *
 * Supports fast standard HTTP extraction, and automatically falls back to
 * headless Chromium (Playwright) when dynamic JavaScript SPAs (React, Next.js) are detected.
 */
export async function scrapePage(
  rawUrl: string,
  options: ScrapeOptions,
  deps: ScrapePageDeps = {},
): Promise<ScrapedPage> {
  const target = parseTargetUrl(rawUrl);

  let html: string;
  let finalUrl: string;
  let bytes: number;
  let isDynamic = false;

  if (options.renderJs === true && !deps.disableBrowser) {
    const dynamic = await fetchDynamicPage(
      target,
      {
        timeoutMs: options.timeoutMs,
        allowedHosts: options.allowedHosts,
      },
      deps,
    );
    html = dynamic.html;
    finalUrl = dynamic.finalUrl;
    bytes = dynamic.bytes;
    isDynamic = true;
  } else {
    const fetched = await fetchPage(
      target,
      {
        timeoutMs: options.timeoutMs,
        maxBytes: options.maxBytes,
        maxRedirects: options.maxRedirects,
      },
      { allowedHosts: options.allowedHosts, ...deps },
    );

    html = fetched.html;
    finalUrl = fetched.finalUrl;
    bytes = fetched.bytes;

    let previewWordCount = 0;
    try {
      const preview = extractContent(html, finalUrl, { maxChars: options.maxChars });
      previewWordCount = preview.wordCount;
    } catch {
      previewWordCount = 0;
    }

    if (
      options.renderJs !== false &&
      !deps.disableBrowser &&
      isDynamicJsShell(html, previewWordCount)
    ) {
      try {
        const dynamic = await fetchDynamicPage(
          target,
          {
            timeoutMs: options.timeoutMs,
            allowedHosts: options.allowedHosts,
          },
          deps,
        );
        html = dynamic.html;
        finalUrl = dynamic.finalUrl;
        bytes = dynamic.bytes;
        isDynamic = true;
      } catch {
        // Continue with static extraction if browser rendering is unavailable
      }
    }
  }

  const extracted = extractContent(html, finalUrl, {
    maxChars: options.maxChars,
  });

  if (isDynamic) {
    extracted.strategy = 'dynamic-playwright';
  }

  return {
    ...extracted,
    requestedUrl: target.toString(),
    finalUrl,
    bytes,
    rawHtml: html,
  };
}
