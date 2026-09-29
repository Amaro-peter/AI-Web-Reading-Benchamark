import cors from '@fastify/cors';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { BENCHMARK_DISCLAIMER } from '../app-info.js';
import type { Env } from '../config/env.js';
import { collectSecrets, redactSecrets } from '../config/secrets.js';
import { isScrapeError, statusForScrapeError } from '../domain/errors.js';
import { benchmarkRoutes, type BenchmarkRouteDeps } from './routes/benchmark.js';
import { healthRoutes } from './routes/health.js';

interface BuildAppOptions {
  env: Env;
  /**
   * false in tests to keep the output readable, or a destination when a test
   * needs to inspect what was logged.
   */
  logger?: boolean | { level?: string; stream: { write(message: string): void } };
  /** Seams the integration tests inject: providers, fetch and judge. */
  benchmark?: Omit<BenchmarkRouteDeps, 'env'>;
}

/**
 * Pino configuration with an error serializer that strips any configured
 * credential. A vendor SDK error can quote the request that failed, and that
 * message must never reach a log.
 */
function buildLoggerOptions(
  logger: NonNullable<BuildAppOptions['logger']>,
  secrets: readonly string[],
) {
  if (logger === false) {
    return false;
  }

  const serializers = {
    err: (error: Error) => ({
      type: error.name,
      message: redactSecrets(error.message, secrets),
      stack: redactSecrets(error.stack ?? '', secrets),
    }),
  };

  return logger === true ? { serializers } : { ...logger, serializers };
}

/**
 * Builds the HTTP application without starting it, so tests can drive it
 * through `app.inject()` with no socket involved.
 */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { env } = options;

  const secrets = collectSecrets(env);

  const app = Fastify({
    logger: buildLoggerOptions(options.logger ?? env.NODE_ENV !== 'test', secrets),
    // A URL is the only user input; a small body limit is plenty.
    bodyLimit: 16 * 1024,
  });

  await app.register(cors, {
    origin: env.FRONTEND_URL,
    methods: ['GET', 'POST'],
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (isScrapeError(error)) {
      return reply
        .status(statusForScrapeError(error.code))
        .send({ error: { code: error.code, message: error.message } });
    }

    const status = error.statusCode ?? 500;

    if (status >= 500) {
      // Log the cause, but never echo an internal message back to the client:
      // it could carry configuration detail.
      request.log.error({ err: error }, 'unhandled error');
      return reply
        .status(500)
        .send({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
    }

    return reply.status(status).send({ error: { code: 'BAD_REQUEST', message: error.message } });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'No such endpoint.' } }),
  );

  await app.register(healthRoutes);
  await app.register(benchmarkRoutes({ env, ...options.benchmark }));

  app.get('/', async () => ({
    service: 'AI Web Reading Benchmark API',
    disclaimer: BENCHMARK_DISCLAIMER,
    endpoints: ['GET /api/health', 'POST /api/benchmark'],
  }));

  return app;
}
