/**
 * Playwright config for server-script e2e tests.
 *
 * These tests require the Bascik HTTP/2 production server (`bascik --serve`)
 * rather than the static file server used by the main e2e suite.  The server
 * uses a self-signed TLS certificate, so `ignoreHTTPSErrors` is set on both
 * the webServer health check and browser pages.
 *
 * Workflow:
 *   1. Build the fixture site into dist/ with `bascik --build`.
 *   2. Start the HTTP/2 production server with `bascik --serve` on port 9443.
 *   3. Playwright tests connect to https://localhost:9443.
 */
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const e2eDir = fileURLToPath(new URL('.', import.meta.url));
const pkgDir = join(e2eDir, '..');

export default defineConfig({
  testDir: './tests',
  testMatch: '**/server-scripts.test.ts',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'https://localhost:9443',
    ignoreHTTPSErrors: true,
    headless: true,
  },
  webServer: {
    command: [
      `node ${pkgDir}/dist/index.js --build`,
      `node ${pkgDir}/dist/index.js --serve`,
    ].join(' && '),
    cwd: e2eDir,
    url: 'https://localhost:9443/server-scripts-test',
    reuseExistingServer: false,
    ignoreHTTPSErrors: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
