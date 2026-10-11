import { defineConfig } from '@playwright/test';
import { env } from './support/env';

// The app and the storefront API must already be running (see e2e/README.md).
// One worker: tests share the server's per-client rate limits and the test customer's cart.
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Reservation and session expiry tests wait for the backend timeouts (1 minute in the test setup).
  timeout: 4 * 60 * 1000,
  expect: { timeout: 10 * 1000 },
  reporter: [['list'], ['html', { outputFolder: './report', open: 'never' }]],
  use: {
    baseURL: env.baseUrl,
    channel: 'chrome',
    headless: true,
    viewport: { width: 1366, height: 900 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'main',
      testIgnore: /rate-limit\.spec\.ts/,
    },
    {
      // Exhausts the server's rate limits on purpose, so it runs last.
      name: 'rate-limit',
      testMatch: /rate-limit\.spec\.ts/,
      dependencies: ['main'],
    },
  ],
});
