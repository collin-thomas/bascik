import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const e2eDir = fileURLToPath(new URL('.', import.meta.url));
const pkgDir = join(e2eDir, '..');

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/server-scripts.test.ts', '**/dev-server-reload.test.ts', '**/prod-server.test.ts'],
  workers: 4,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4200',
    headless: true,
  },
  webServer: {
    // 1. Build the fixture site using the current pkg dist.
    // 2. Serve dist/ with the minimal static file server.
    command: `node ${pkgDir}/dist/index.js --build && node server.ts 4200`,
    cwd: e2eDir,
    url: 'http://localhost:4200/scope-test',
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
