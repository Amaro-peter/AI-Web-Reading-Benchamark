import type { FastifyPluginAsync } from 'fastify';
import { APP_NAME, APP_VERSION } from '../../app-info.js';

/**
 * Liveness endpoint. Deliberately says nothing about credentials or
 * infrastructure — only that the process is up.
 */
export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/health', async () => ({
    status: 'ok' as const,
    service: APP_NAME,
    version: APP_VERSION,
    uptimeSeconds: Math.floor(process.uptime()),
  }));
};
