import { defineConfig } from '@bascik/bascik/config';

export default defineConfig({
  watch: ['scripts/', 'content/', '../pkg/test-coverage.json', '../pkg/e2e-test-coverage.json'],
  exec: [
    { script: 'scripts/generate-search-index.ts', watch: ['content/'] },
  ],
  siteUrl: 'https://bascik.dev',
  inlineStyles: ['src/pages/css/styles.css'],
});
