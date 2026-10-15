import { defineConfig } from '@playwright/test';

const BASE_URL = 'http://localhost:4173';

/**
 * End-to-end suite for Fifteen. Four projects: desktop and mobile, each in light and dark.
 * The app is built and served by `vite preview` so tests exercise the production bundle.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: 'list',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'desktop-light',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 }, colorScheme: 'light' },
    },
    {
      name: 'desktop-dark',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 }, colorScheme: 'dark' },
    },
    {
      name: 'mobile-light',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
        colorScheme: 'light',
      },
    },
    {
      name: 'mobile-dark',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
        colorScheme: 'dark',
      },
    },
  ],
});
