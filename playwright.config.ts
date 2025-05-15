/**
 * @file playwright.config.ts
 * @description Global Playwright test configuration for Grafana Warp10 plugin testing.
 *
 * This config:
 * - Defines test directories and test match patterns
 * - Enables multiple browser projects (Chromium, Firefox, WebKit)
 * - Integrates authentication via @grafana/plugin-e2e
 * - Enables parallelism, retries (CI), HTML reporting, and baseURL support
 *
 * Notes:
 * - The 'auth' project runs the login scenario first and stores credentials
 * - All other projects depend on 'auth' and reuse the stored state
 * - Test files should be placed in `./tests` directory and use `.spec.ts` extension
 */
import type { PluginOptions } from '@grafana/plugin-e2e';
import { defineConfig, devices } from '@playwright/test';
import { dirname } from 'node:path';

const pluginE2eAuth = `${dirname(require.resolve('@grafana/plugin-e2e'))}/auth`;

export default defineConfig<PluginOptions>({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.GRAFANA_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'auth',
      testDir: pluginE2eAuth,
      testMatch: [/.*\.js/],
    },
    {
      name: 'chromium',
      testDir: './tests',
      testMatch: ['*.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['auth'],
    },
    {
      name: 'firefox',
      testDir: './tests',
      testMatch: ['*.spec.ts'],
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['auth'],
    },
  ],
});
