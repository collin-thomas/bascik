// Obfuscation stays off (dev default) so Playwright assertions match readable
// scoped names like `bascik__scope-test__active` rather than opaque hashes.
import { defineConfig } from '@bascik/bascik/config';

export const bascikConfig = defineConfig({
  siteUrl: 'http://localhost:4200',
  useWorkers: true,
  serve: {
    port: 9443,
  },
});
