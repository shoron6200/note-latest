import { defineConfig, devices } from '@playwright/test';

/**
 * Specs run against the web export (real SQLite in WebAssembly).
 * Build it first: npx expo export --platform web
 * Each test gets a fresh browser context, so a fresh, empty database.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 6_000 },
  reporter: [['list'], ['json', { outputFile: 'e2e/results.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:8766',
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } }, testMatch: ['a11y.spec.ts', 'settings.spec.ts'] },
  ],
  webServer: {
    command: 'python3 -I e2e/web/spa.py "$PWD/dist" 8766',
    url: 'http://127.0.0.1:8766',
    reuseExistingServer: true,
  },
});
