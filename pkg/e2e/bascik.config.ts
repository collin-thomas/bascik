// Obfuscation stays off so Playwright assertions match readable scoped names
// like `bascik__scope-test__active` rather than opaque hashes. Must be set
// explicitly because bascik --build defaults obfuscateAttributeNames to true.
import { defineConfig } from '@bascik/bascik/config';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import { transform } from 'esbuild';

export default defineConfig({
  siteUrl: 'http://localhost:4200',
  useWorkers: true,
  obfuscateAttributeNames: false,
  minify: {
    css: async (css) => {
      const result = await postcss([autoprefixer]).process(css, { from: undefined });
      return result.css;
    },
    js: async (code) => {
      const result = await transform(code, { loader: 'js', minify: true });
      return result.code;
    },
  },
  exec: [
    { script: 'scripts/generate-manifest.ts' },
  ],
  serve: {
    port: 9443,
  },
});
