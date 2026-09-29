import { defineConfig, devices } from '@playwright/test';

const FRONTEND_PORT = 3100;
const BACKEND_PORT = 3101;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Backend started with no API keys and AI_PROVIDER_MODE=mock:
      // E2E never touches a real AI API.
      command: `npm run start -w backend`,
      port: BACKEND_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(BACKEND_PORT),
        HOST: '127.0.0.1',
        NODE_ENV: 'test',
        AI_PROVIDER_MODE: 'mock',
        FRONTEND_URL: `http://127.0.0.1:${FRONTEND_PORT}`,
      },
    },
    {
      command: `npm run start -w frontend -- -p ${FRONTEND_PORT}`,
      port: FRONTEND_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${BACKEND_PORT}`,
      },
    },
  ],
});
