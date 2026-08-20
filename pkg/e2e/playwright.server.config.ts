/**
 * Playwright config for running E2E tests against the Bascik HTTP/2 Production Server (`bascik --serve`).
 *
 * Runs the full E2E test suite (scoping, slots, CSS, JS, components, DOM, etc.)
 * plus `data-bascik-server` script execution and prod server HTTP/2 tests
 * directly against `bascik --serve`.
 *
 * Run with:
 *   npx playwright test --config e2e/playwright.server.config.ts
 */
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const e2eDir = fileURLToPath(new URL('.', import.meta.url));
const pkgDir = join(e2eDir, '..');

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/dev-server-reload.test.ts'],
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:9443',
    ignoreHTTPSErrors: true,
    headless: true,
  },
  webServer: {
    command: [
      `node ${pkgDir}/dist/index.js --build`,
      `node ${pkgDir}/dist/index.js --serve`,
    ].join(' && '),
    cwd: e2eDir,
    url: 'http://localhost:9443/server-scripts-test',
    reuseExistingServer: false,
    ignoreHTTPSErrors: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
