import { describe, expect, it } from 'vitest';
import type { Browser } from 'playwright';
import { ScrapeError } from '../../src/domain/errors.js';
import { fetchDynamicPage } from '../../src/scraper/browser-fetch.js';
import { isDynamicJsShell } from '../../src/scraper/index.js';

describe('isDynamicJsShell', () => {
  it('detects empty React root container', () => {
    const html =
      '<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>';
    expect(isDynamicJsShell(html, 0)).toBe(true);
  });

  it('detects Next.js container shell', () => {
    const html =
      '<html><body><div id="__next"> </div><script src="/_next/static/app.js"></script></body></html>';
    expect(isDynamicJsShell(html, 5)).toBe(true);
  });

  it('detects noscript javascript requirement message', () => {
    const html =
      '<html><body><noscript>You need to enable JavaScript to run this app.</noscript></body></html>';
    expect(isDynamicJsShell(html, 10)).toBe(true);
  });

  it('does not classify full static articles as dynamic shells', () => {
    const html =
      '<html><body><article><h1>Static News</h1><p>This is a completely normal static news article with dozens of words already present in the initial server response.</p></article></body></html>';
    expect(isDynamicJsShell(html, 50)).toBe(false);
  });
});

describe('fetchDynamicPage', () => {
  const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
  const privateLookup = async () => [{ address: '127.0.0.1', family: 4 }];

  it('rejects URLs pointing at private/blocked IP addresses before launching browser', async () => {
    await expect(
      fetchDynamicPage(
        new URL('http://127.0.0.1:8080/'),
        { timeoutMs: 2000 },
        { lookup: privateLookup },
      ),
    ).rejects.toMatchObject({
      code: 'BLOCKED_HOST',
    });
  });

  it('renders dynamic content using mock browser deps', async () => {
    const mockPage = {
      goto: async () => undefined,
      waitForLoadState: async () => undefined,
      waitForSelector: async () => undefined,
      url: () => 'https://example.com/client-rendered',
      content: async () =>
        '<html><body><div id="root"><h1>Hydrated React Heading</h1><p>Client side content rendered here.</p></div></body></html>',
    };

    const mockContext = {
      route: async () => undefined,
      newPage: async () => mockPage,
      close: async () => undefined,
    };

    const mockBrowser = {
      newContext: async () => mockContext,
      close: async () => undefined,
    };

    const result = await fetchDynamicPage(
      new URL('https://example.com/client-rendered'),
      { timeoutMs: 5000 },
      {
        lookup: publicLookup,
        launchBrowser: async () => mockBrowser as unknown as Browser,
      },
    );

    expect(result.requestedUrl).toBe('https://example.com/client-rendered');
    expect(result.html).toContain('Hydrated React Heading');
    expect(result.bytes).toBeGreaterThan(0);
  });

  it('handles browser rendering timeouts gracefully', async () => {
    const mockBrowser = {
      newContext: async () => ({
        route: async () => undefined,
        newPage: async () => ({
          goto: async () => {
            throw new Error('Navigation timeout of 100ms exceeded');
          },
        }),
        close: async () => undefined,
      }),
      close: async () => undefined,
    };

    await expect(
      fetchDynamicPage(
        new URL('https://example.com/timeout'),
        { timeoutMs: 100 },
        {
          lookup: publicLookup,
          launchBrowser: async () => mockBrowser as unknown as Browser,
        },
      ),
    ).rejects.toThrow(ScrapeError);
  });
});
