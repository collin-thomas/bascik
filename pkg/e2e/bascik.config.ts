// Obfuscation stays off so Playwright assertions match readable scoped names
// like `bascik__scope-test__active` rather than opaque hashes. Must be set
// explicitly because bascik --build defaults obfuscateAttributeNames to true.
import { defineConfig } from '@bascik/bascik/config';

export default defineConfig({
  siteUrl: 'http://localhost:4200',
  useWorkers: true,
  obfuscateAttributeNames: false,
  minifyStyles: false,
  serve: {
    port: 9443,
  },
});
