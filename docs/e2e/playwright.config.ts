import { defineConfig } from '@playwright/test';

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
    command: 'npx bascik --build && npx bascik --serve 4200',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
