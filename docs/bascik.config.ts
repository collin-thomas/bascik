import { defineConfig } from '@bascik/bascik/config';

export const bascikConfig = defineConfig({
  directory: {
    watch: ['scripts/', 'content/', '../pkg/test-coverage.json', '../pkg/e2e-test-coverage.json'],
  },
  siteUrl: 'https://bascik.dev',
  inlineStyles: ['src/pages/css/styles.css'],
});
