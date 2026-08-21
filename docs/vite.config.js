import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'lighthouse/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'scripts/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'lighthouse/**/*.test.ts'],
    },
  },
});
