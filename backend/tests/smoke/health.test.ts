import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/http/app.js';
import { loadEnv } from '../../src/config/env.js';

const env = loadEnv({ NODE_ENV: 'test', AI_PROVIDER_MODE: 'mock' });

describe('smoke: the service comes up and answers', () => {
  it('GET /api/health returns 200', async () => {
    const app = await buildApp({ env, logger: false });
    try {
      const response = await app.inject({ method: 'GET', url: '/api/health' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: 'ok' });
    } finally {
      await app.close();
    }
  });

  it('GET / describes the API and carries the experimental disclaimer', async () => {
    const app = await buildApp({ env, logger: false });
    try {
      const response = await app.inject({ method: 'GET', url: '/' });
      expect(response.statusCode).toBe(200);
      expect(response.json().disclaimer).toContain('Experimental');
    } finally {
      await app.close();
    }
  });

  it('an unknown route returns a structured 404', async () => {
    const app = await buildApp({ env, logger: false });
    try {
      const response = await app.inject({ method: 'GET', url: '/nope' });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('NOT_FOUND');
    } finally {
      await app.close();
    }
  });
});
