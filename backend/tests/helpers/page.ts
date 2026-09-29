import { loadEnv } from '../../src/config/env.js';
import { scrapeOptionsFromEnv, scrapePage, type ScrapedPage } from '../../src/scraper/index.js';
import type { LookupFn } from '../../src/scraper/ssrf.js';
import { FIXTURE_URL, loadFixture, type FixtureName } from './fixtures.js';

/** A resolver that always answers with a public address. */
export const publicLookup: LookupFn = async () => [{ address: '93.184.216.34', family: 4 }];

/** A fetch stub serving one fixed HTML document. */
export function stubFetch(html: string): typeof fetch {
  return async () =>
    new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
}

/** Scrapes a fixture through the real pipeline, with the network stubbed out. */
export async function scrapeFixture(name: FixtureName = 'article'): Promise<ScrapedPage> {
  return scrapePage(FIXTURE_URL, scrapeOptionsFromEnv(loadEnv({})), {
    fetchImpl: stubFetch(loadFixture(name)),
    lookup: publicLookup,
  });
}
