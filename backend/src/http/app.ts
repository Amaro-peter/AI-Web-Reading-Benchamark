import cors from '@fastify/cors';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { BENCHMARK_DISCLAIMER } from '../app-info.js';
import type { Env } from '../config/env.js';
import { isScrapeError, statusForScrapeError } from '../domain/errors.js';
import { healthRoutes } from './routes/health.js';

interface BuildAppOptions {
  env: Env;
  /** Set to false in tests to keep the output readable. */
  logger?: boolean;
}

/**
 * Builds the HTTP application without starting it, so tests can drive it
 * through `app.inject()` with no socket involved.
 */
export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { env } = options;

  const app = Fastify({
    logger: options.logger ?? env.NODE_ENV !== 'test',
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

  app.get('/', async () => ({
    service: 'AI Web Reading Benchmark API',
    disclaimer: BENCHMARK_DISCLAIMER,
    endpoints: ['GET /api/health', 'POST /api/benchmark'],
  }));

  return app;
}
