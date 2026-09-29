import { Readability } from '@mozilla/readability';
import { JSDOM, VirtualConsole } from 'jsdom';
import { ScrapeError } from '../domain/errors.js';
import {
  countWords,
  normalizeBlockText,
  normalizeWhitespace,
  truncateAtWordBoundary,
} from '../domain/text.js';

/**
 * Elements that are never part of the article. Readability already discards
 * most of them, but the fallback path and the heading scan need the page
 * cleaned up too.
 */
const NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'svg',
  'nav',
  'header',
  'footer',
  'aside',
  'form',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[aria-hidden="true"]',
  '.advertisement',
  '.ad',
  '.ads',
  '.cookie-banner',
  '.newsletter',
  '.related-posts',
  '.comments',
  '.sidebar',
  '.social-share',
].join(',');

/** Below this, there is not enough text to ask anything meaningful about. */
export const MIN_CONTENT_WORDS = 20;

/** Readability output shorter than this is treated as a failed extraction. */
const MIN_READABILITY_CHARS = 200;

const MAX_HEADINGS = 20;

export interface ExtractedPage {
  title: string;
  byline: string | null;
  siteName: string | null;
  description: string | null;
  lang: string | null;
  publishedTime: string | null;
  headings: string[];
  /** Main text, already truncated to the configured budget. */
  text: string;
  /** Word count of the full extracted text, before truncation. */
  wordCount: number;
  charCount: number;
  truncated: boolean;
  /** How the text was obtained — useful when a result looks wrong. */
  strategy: 'readability' | 'fallback';
}

export interface ExtractOptions {
  maxChars: number;
}

/**
 * Extracts the main content of an HTML document.
 *
 * Parsing is delegated to jsdom and article detection to Mozilla's Readability
 * — the same engine behind Firefox Reader View. No hand-written HTML parsing:
 * that is where both correctness and security problems live.
 *
 * jsdom is constructed without `runScripts`, so no script in the fetched page
 * is ever executed, and its virtual console is silenced so a malformed page
 * cannot spam our logs.
 */
export function extractContent(html: string, url: string, options: ExtractOptions): ExtractedPage {
  const dom = buildDom(html, url);

  try {
    const document = dom.window.document;
    const metadata = readMetadata(document);

    const article = runReadability(dom, url);
    const readableText = article ? normalizeBlockText(article.textContent ?? '') : '';

    const useReadability = readableText.length >= MIN_READABILITY_CHARS;
    const fullText = useReadability ? readableText : fallbackText(document);
    const strategy: ExtractedPage['strategy'] = useReadability ? 'readability' : 'fallback';

    const wordCount = countWords(fullText);
    if (wordCount < MIN_CONTENT_WORDS) {
      throw new ScrapeError('EMPTY_CONTENT', 'No readable article content was found on that page.');
    }

    const text = truncateAtWordBoundary(fullText, options.maxChars);
    const title = preferHeadline(
      normalizeWhitespace(article?.title ?? '') || metadata.title || normalizeWhitespace(url),
      document,
    );

    return {
      title,
      byline: normalizeOrNull(article?.byline ?? null) ?? metadata.byline,
      siteName: normalizeOrNull(article?.siteName ?? null) ?? metadata.siteName,
      description: metadata.description ?? normalizeOrNull(article?.excerpt ?? null),
      lang: metadata.lang,
      publishedTime: normalizeOrNull(article?.publishedTime ?? null) ?? metadata.publishedTime,
      headings: collectHeadings(dom, article?.content ?? null, document),
      text,
      wordCount,
      charCount: fullText.length,
      truncated: text.length < fullText.length,
      strategy,
    };
  } finally {
    dom.window.close();
  }
}

/**
 * Page titles routinely carry a site suffix ("Headline - The Daily"). When the
 * document has a single h1 and the document title merely prefixes it, the
 * headline is the better answer.
 */
function preferHeadline(title: string, document: Document): string {
  const headings = document.querySelectorAll('h1');
  const first = headings[0];
  if (headings.length !== 1 || first === undefined) {
    return title;
  }

  const headline = normalizeWhitespace(first.textContent ?? '');
  const longEnoughToTrust = headline.length >= 10;

  return longEnoughToTrust && title.startsWith(headline) ? headline : title;
}

function buildDom(html: string, url: string): JSDOM {
  const virtualConsole = new VirtualConsole();
  // A hostile or simply broken page must not be able to write to our logs.
  virtualConsole.on('error', () => undefined);
  virtualConsole.on('jsdomError', () => undefined);

  try {
    return new JSDOM(html, { url, virtualConsole, runScripts: undefined });
  } catch {
    throw new ScrapeError('EMPTY_CONTENT', 'That page could not be parsed as HTML.');
  }
}

type ReadabilityResult = ReturnType<Readability['parse']>;

function runReadability(dom: JSDOM, url: string): ReadabilityResult {
  try {
    const clone = new JSDOM('<!doctype html><html></html>', { url });
    const imported = clone.window.document.importNode(dom.window.document.documentElement, true);
    clone.window.document.replaceChild(imported, clone.window.document.documentElement);

    // Readability scores containers by text density, and a long enough cookie
    // banner or ad block can win. Remove the structurally obvious non-article
    // elements first so it scores only candidate content.
    clone.window.document.querySelectorAll(NOISE_SELECTORS).forEach((node) => {
      node.remove();
    });

    return new Readability(clone.window.document).parse();
  } catch {
    // Readability throws on some pathological documents; the fallback covers it.
    return null;
  }
}

function fallbackText(document: Document): string {
  const body = document.body;
  if (body === null) {
    return '';
  }
  body.querySelectorAll(NOISE_SELECTORS).forEach((node) => {
    node.remove();
  });
  return normalizeBlockText(body.textContent ?? '');
}

function collectHeadings(dom: JSDOM, articleHtml: string | null, document: Document): string[] {
  const fromArticle = articleHtml === null ? [] : headingsFromHtml(dom, articleHtml);
  if (fromArticle.length > 0) {
    return fromArticle;
  }

  const clone = document.cloneNode(true) as Document;
  clone.querySelectorAll(NOISE_SELECTORS).forEach((node) => {
    node.remove();
  });
  return dedupe(
    [...clone.querySelectorAll('h1, h2, h3, h4')]
      .map((el) => normalizeWhitespace(el.textContent ?? ''))
      .filter((text) => text.length > 0),
  );
}

function headingsFromHtml(dom: JSDOM, html: string): string[] {
  const container = dom.window.document.createElement('div');
  container.innerHTML = html;
  return dedupe(
    [...container.querySelectorAll('h1, h2, h3, h4')]
      .map((el) => normalizeWhitespace(el.textContent ?? ''))
      .filter((text) => text.length > 0),
  );
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)].slice(0, MAX_HEADINGS);
}

interface PageMetadata {
  title: string;
  byline: string | null;
  siteName: string | null;
  description: string | null;
  lang: string | null;
  publishedTime: string | null;
}

function readMetadata(document: Document): PageMetadata {
  const meta = (selector: string): string | null =>
    normalizeOrNull(document.querySelector(selector)?.getAttribute('content') ?? null);

  return {
    title: normalizeWhitespace(document.title ?? '') || meta('meta[property="og:title"]') || '',
    byline: meta('meta[name="author"]') ?? meta('meta[property="article:author"]'),
    siteName: meta('meta[property="og:site_name"]'),
    description: meta('meta[name="description"]') ?? meta('meta[property="og:description"]'),
    lang: normalizeOrNull(document.documentElement.getAttribute('lang')),
    publishedTime:
      meta('meta[property="article:published_time"]') ??
      meta('meta[name="date"]') ??
      normalizeOrNull(document.querySelector('time[datetime]')?.getAttribute('datetime') ?? null),
  };
}

function normalizeOrNull(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const normalized = normalizeWhitespace(value);
  return normalized.length === 0 ? null : normalized;
}
