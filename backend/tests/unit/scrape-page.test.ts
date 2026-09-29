import { describe, expect, it, vi } from 'vitest';
import { scrapeOptionsFromEnv, scrapePage } from '../../src/scraper/index.js';
import { loadEnv } from '../../src/config/env.js';
import type { LookupFn } from '../../src/scraper/ssrf.js';
import { FIXTURE_URL, loadFixture } from '../helpers/fixtures.js';

const publicLookup: LookupFn = async () => [{ address: '93.184.216.34', family: 4 }];

function htmlFetch(html: string) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    );
}

const options = scrapeOptionsFromEnv(loadEnv({}));

describe('scrapePage', () => {
  it('runs validate -> fetch -> extract and returns one page record', async () => {
    const page = await scrapePage(FIXTURE_URL, options, {
      fetchImpl: htmlFetch(loadFixture('article')),
      lookup: publicLookup,
    });

    expect(page.requestedUrl).toBe(FIXTURE_URL);
    expect(page.finalUrl).toBe(FIXTURE_URL);
    expect(page.title).toBe("Lisbon's tram network turns 150");
    expect(page.wordCount).toBeGreaterThan(300);
    expect(page.bytes).toBeGreaterThan(0);
    expect(page.headings.length).toBe(4);
  });

  it('reports the final URL after a redirect', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, { status: 301, headers: { location: 'https://final.example/a' } }),
      )
      .mockResolvedValueOnce(
        new Response(loadFixture('article'), {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      );

    const page = await scrapePage('https://start.example/a', options, {
      fetchImpl,
      lookup: publicLookup,
    });

    expect(page.requestedUrl).toBe('https://start.example/a');
    expect(page.finalUrl).toBe('https://final.example/a');
  });

  it('rejects an invalid URL before touching the network', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      scrapePage('javascript:alert(1)', options, { fetchImpl, lookup: publicLookup }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED_SCHEME' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('surfaces EMPTY_CONTENT for a page with nothing readable', async () => {
    await expect(
      scrapePage(FIXTURE_URL, options, {
        fetchImpl: htmlFetch(loadFixture('empty')),
        lookup: publicLookup,
      }),
    ).rejects.toMatchObject({ code: 'EMPTY_CONTENT' });
  });

  it('caps the text it returns at the configured character budget', async () => {
    const page = await scrapePage(
      FIXTURE_URL,
      { ...options, maxChars: 400 },
      { fetchImpl: htmlFetch(loadFixture('article')), lookup: publicLookup },
    );
    expect(page.text.length).toBeLessThanOrEqual(400);
    expect(page.truncated).toBe(true);
  });
});

describe('scrapeOptionsFromEnv', () => {
  it('derives every limit from configuration', () => {
    const env = loadEnv({
      SCRAPER_TIMEOUT_MS: '1234',
      SCRAPER_MAX_BYTES: '4321',
      MAX_CONTENT_CHARS: '999',
    });
    expect(scrapeOptionsFromEnv(env)).toEqual({
      timeoutMs: 1234,
      maxBytes: 4321,
      maxChars: 999,
      maxRedirects: 5,
      allowedHosts: [],
    });
  });

  it('carries the configured host allowlist through to the fetcher', () => {
    const env = loadEnv({ SCRAPER_ALLOWED_HOSTS: 'fixtures.internal' });
    expect(scrapeOptionsFromEnv(env).allowedHosts).toEqual(['fixtures.internal']);
  });

  it('defaults the host allowlist to empty', () => {
    expect(scrapeOptionsFromEnv(loadEnv({})).allowedHosts).toEqual([]);
  });
});
