import type { FastifyInstance } from 'fastify';
import { loadEnv, type Env } from '../../src/config/env.js';
import type { Judge } from '../../src/evaluation/judge.js';
import { buildApp } from '../../src/http/app.js';
import type { RegisteredProvider } from '../../src/providers/types.js';
import { loadFixture, type FixtureName } from './fixtures.js';
import { publicLookup, stubFetch } from './page.js';

interface TestAppOptions {
  env?: NodeJS.ProcessEnv;
  /** HTML the stubbed fetch will serve, by fixture name or raw string. */
  html?: FixtureName | { raw: string };
  /** Replaces the whole fetch, for error-path tests. */
  fetchImpl?: typeof fetch;
  providers?: RegisteredProvider[];
  judge?: Judge;
}

/**
 * Builds the real application with the network and the provider line-up
 * stubbed. Everything between the HTTP layer and those two seams — routing,
 * validation, scraping, extraction, benchmarking, evaluation, serialisation —
 * is the real code under test.
 */
export async function buildTestApp(options: TestAppOptions = {}): Promise<FastifyInstance> {
  const env: Env = loadEnv({ NODE_ENV: 'test', ...options.env });

  const html =
    options.html === undefined
      ? loadFixture('article')
      : typeof options.html === 'string'
        ? loadFixture(options.html)
        : options.html.raw;

  return buildApp({
    env,
    logger: false,
    benchmark: {
      scrapeDeps: {
        fetchImpl: options.fetchImpl ?? stubFetch(html),
        lookup: publicLookup,
      },
      ...(options.providers === undefined
        ? {}
        : { createProvidersFn: () => options.providers ?? [] }),
      ...(options.judge === undefined ? {} : { judge: options.judge }),
    },
  });
}

export const VALID_URL = 'https://fixtures.test/article';
