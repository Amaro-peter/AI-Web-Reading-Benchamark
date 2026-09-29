import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { runBenchmark } from '../../benchmark/run.js';
import type { Env } from '../../config/env.js';
import type { Judge } from '../../evaluation/judge.js';
import { createProviders } from '../../providers/registry.js';
import type { RegisteredProvider } from '../../providers/types.js';
import { scrapeOptionsFromEnv, scrapePage } from '../../scraper/index.js';
import type { FetchPageDeps } from '../../scraper/fetch-page.js';

/** The only field a caller supplies. Anything else is rejected. */
const BenchmarkRequestSchema = z
  .object({
    url: z.string({ required_error: 'A url is required.' }).min(1, 'A url is required.'),
  })
  .strict();

export interface BenchmarkRouteDeps {
  env: Env;
  /** Overridable so integration tests can drive the route without a network. */
  createProvidersFn?: (env: Env) => RegisteredProvider[];
  scrapeDeps?: FetchPageDeps;
  judge?: Judge;
}

export function benchmarkRoutes(deps: BenchmarkRouteDeps): FastifyPluginAsync {
  const { env } = deps;
  const buildProviders = deps.createProvidersFn ?? createProviders;
  const scrapeOptions = scrapeOptionsFromEnv(env);

  return async (app) => {
    app.post('/api/benchmark', async (request, reply) => {
      const parsed = BenchmarkRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_REQUEST',
            message: parsed.error.issues[0]?.message ?? 'Invalid request body.',
          },
        });
      }

      // A ScrapeError thrown here is turned into the right status by the
      // application-level error handler.
      const page = await scrapePage(parsed.data.url, scrapeOptions, deps.scrapeDeps);

      const run = await runBenchmark({
        page,
        providers: buildProviders(env),
        timeoutMs: env.PROVIDER_TIMEOUT_MS,
        ...(deps.judge === undefined ? {} : { judge: deps.judge }),
      });

      return reply.status(200).send(run);
    });
  };
}
