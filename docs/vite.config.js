import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    include: ['src/**/*.test.mjs', 'scripts/**/*.test.ts'],
  },
});
