import { chromium, type Browser } from 'playwright';
import { ScrapeError } from '../domain/errors.js';
import { assertSafeUrl, type LookupFn } from './ssrf.js';

const USER_AGENT =
  'AIWebReadingBenchmark/0.1 (+https://github.com/Amaro-peter/AI-Web-Reading-Benchamark; Headless Chrome)';

interface BrowserFetchOptions {
  timeoutMs: number;
  allowedHosts?: readonly string[];
}

export interface BrowserFetchDeps {
  lookup?: LookupFn;
  launchBrowser?: () => Promise<Browser>;
}

interface BrowserFetchedPage {
  requestedUrl: string;
  finalUrl: string;
  html: string;
  bytes: number;
}

/**
 * Fetches dynamic, JavaScript-rendered web pages (React, Next.js, Vue, Angular, SPA)
 * using headless Chromium under strict SSRF and resource bounds.
 */
export async function fetchDynamicPage(
  target: URL,
  options: BrowserFetchOptions,
  deps: BrowserFetchDeps = {},
): Promise<BrowserFetchedPage> {
  const allowedHosts = options.allowedHosts ?? [];
  const lookup = deps.lookup;

  // SSRF pre-flight validation on the requested URL
  await assertSafeUrl(target, lookup, allowedHosts);

  const launch =
    deps.launchBrowser ??
    (() =>
      chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
        ],
      }));

  let browser: Browser | null = null;

  try {
    browser = await launch();
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 800 },
      javaScriptEnabled: true,
    });

    // Guard subresource fetching against SSRF/internal network pivots
    await context.route('**/*', async (route) => {
      try {
        const reqUrl = new URL(route.request().url());
        if (reqUrl.protocol === 'http:' || reqUrl.protocol === 'https:') {
          await assertSafeUrl(reqUrl, lookup, allowedHosts);
        }
        await route.continue();
      } catch {
        await route.abort('blockedbyclient');
      }
    });

    const page = await context.newPage();

    // Navigate with timeout
    await page.goto(target.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: options.timeoutMs,
    });

    // Wait for client-side hydration or main SPA container mounting
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: Math.min(options.timeoutMs, 4000) }),
      page.waitForSelector(
        '#root > *, #__next > *, [data-reactroot], app-root > *, #app > *, main, article',
        { timeout: Math.min(options.timeoutMs, 2500) },
      ),
    ]).catch(() => {
      // Gracefully continue with whatever DOM has loaded if hydration listener expires
    });

    const finalUrl = page.url();
    // Validate final redirected URL against SSRF rules
    await assertSafeUrl(new URL(finalUrl), lookup, allowedHosts);

    const html = await page.content();
    const bytes = Buffer.byteLength(html, 'utf8');

    await context.close();

    return {
      requestedUrl: target.toString(),
      finalUrl,
      html,
      bytes,
    };
  } catch (error) {
    if (error instanceof ScrapeError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Timeout') || message.includes('timeout')) {
      throw new ScrapeError('TIMEOUT', `Browser rendering timed out after ${options.timeoutMs}ms.`);
    }
    throw new ScrapeError('FETCH_FAILED', `Browser rendering failed: ${message}`);
  } finally {
    if (browser !== null) {
      await browser.close().catch(() => {});
    }
  }
}
