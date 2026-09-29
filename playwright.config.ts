import { defineConfig, devices } from '@playwright/test';

const FRONTEND_PORT = 3100;
const BACKEND_PORT = 3101;
const FIXTURE_PORT = 3102;

export const FIXTURE_ORIGIN = `http://127.0.0.1:${FIXTURE_PORT}`;

/**
 * The full system under test: browser -> Next.js -> Fastify -> mock providers.
 *
 * Two things keep it deterministic and offline:
 *   - AI_PROVIDER_MODE=mock, so no request ever reaches a paid API;
 *   - a local fixture server instead of a real website, reachable only
 *     because the backend is started with that one host allowlisted.
 *
 * The frontend is rebuilt here because Next inlines NEXT_PUBLIC_* at build
 * time: starting it with a different value would have no effect.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/fixture-server.mjs',
      port: FIXTURE_PORT,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { FIXTURE_PORT: String(FIXTURE_PORT) },
    },
    {
      command: 'npm run build -w backend && npm run start -w backend',
      port: BACKEND_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        PORT: String(BACKEND_PORT),
        HOST: '127.0.0.1',
        NODE_ENV: 'production',
        AI_PROVIDER_MODE: 'mock',
        FRONTEND_URL: `http://127.0.0.1:${FRONTEND_PORT}`,
        SCRAPER_ALLOWED_HOSTS: '127.0.0.1',
      },
    },
    {
      command: `npm run build -w frontend && npm run start -w frontend -- -p ${FRONTEND_PORT}`,
      port: FRONTEND_PORT,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${BACKEND_PORT}`,
      },
    },
  ],
});
