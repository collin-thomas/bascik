import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const e2eDir = fileURLToPath(new URL('.', import.meta.url));
const pkgIndex = join(e2eDir, '../../pkg/dist/index.js');

export default defineConfig({
  testDir: './',
  workers: 4,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4200',
    headless: true,
  },
  webServer: {
    command: `node ${pkgIndex} --build && node ${pkgIndex} --serve`,
    cwd: join(e2eDir, '..'),
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
