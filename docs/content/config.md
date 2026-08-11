# Configuration

Create a `bascik.config.js` file in your project root to override any default settings.

## Full Example

```js
// bascik.config.js
export const bascikConfig = {
  directory: {
    pages: 'src/pages',
    components: 'src/components',
    watch: ['scripts/', 'data/'],
  },

  scopeScriptBlocks: true,
  inheritAttributes: true,
  scopeAttribute: {
    class: true,
    id: true,
    name: true,
  },
  skipTranspilingElementContents: ['code'],

  deduplicateCss: true,
  minifyStyles: true,
  inlineStyles: ['src/pages/css/styles.css'],

  minifyScripts: true,

  obfuscateAttributeNames: true,

  cacheHttp: false,  // true by default in --serve mode
  verboseLogging: false,

  siteUrl: 'https://example.com',
  generate: {
    sitemap: true,
    robots: true,
  },

  useWorkers: false,
};

export const buildOverrideConfig = {
  obfuscateAttributeNames: true,
  minifyStyles: true,
};
```

## Options Reference

### `directory`

Paths to your pages and components directories. Relative to the project root.

```js
directory: {
  pages: 'src/pages',      // default
  components: 'src/components', // default
}
```

### `scopeScriptBlocks`

Wrap component `<script>` tags in an IIFE and rewrite scoped attribute references. Set to `false` if you want raw unmodified script output.

```js
scopeScriptBlocks: true // default
```

### `inheritAttributes`

Control whether non-`data-bascik-*` attributes on a component usage tag are merged onto the component root element. Defaults to `true`.

```js
inheritAttributes: true // default
```

### `scopeAttribute`

Control which HTML attribute types are scoped independently. Useful if you're using Tailwind (`class: false`) or don't need name scoping.

```js
scopeAttribute: {
  class: true, // default
  id: true,    // default
  name: true,  // default
}
```

### `deduplicateCss`

When `true` (default), all instances of the same component share the same scoped class names so the compiled `<style>` block is emitted only once per component type, regardless of how many times the component appears on the page.

When `false`, every instance gets its own unique per-instance class names (the same scheme used for `id` scoping). This means a `querySelector('.myClass')` inside a component script will naturally target only elements inside that specific instance, but each instance emits its own `<style>` block.

```js
deduplicateCss: true // default
```

> **Choosing `false`:** Use per-instance class scoping when a component's JavaScript needs to use class selectors to locate its own root element and you have multiple instances of that component on the same page. For most components, using an `id` attribute to anchor the script (which is always per-instance) is a simpler alternative.

### `skipTranspilingElementContents`

An array of HTML element names whose inner content is left untouched by the scoping pipeline. Attribute values, element-selector class injection, and JS selector rewriting are all skipped for any HTML found *inside* these elements. The elements' own opening-tag attributes (e.g. `class="cblock-body"` on `<code>` itself) are still scoped normally.

Defaults to `["code"]`: the typical element used to display literal code examples. Add `"pre"` only if your templates contain raw text inside `<pre>` blocks that aren't wrapped in `<code>` and whose content has attribute patterns you don't want scoped. Note: when `"pre"` is in the list, attributes on elements *inside* `<pre>` (such as `class="cblock-body"` on a `<code>` child) are also excluded from scoping.

```js
skipTranspilingElementContents: ['code'] // default
```

Set to an empty array to disable the protection entirely, or extend the list for other elements whose contents should be preserved as-is.

### `minifyStyles`

Collapse whitespace and newlines in the injected `<style>` block. Defaults to `true`.

### `minifyScripts`

Minify inline `<script>` content and `.js` static files in the build output. Accepts three forms:

- **`true`** (default), built-in minifier: strips block and line comments, collapses whitespace. String and template literals are preserved verbatim.
- **`false`:** no minification.
- **`(fn)`:** a custom async-capable function called for each script body. Use this to plug in esbuild, terser, or any other tool:

```js
// bascik.config.js
import { transform } from 'esbuild';

export const buildOverrideConfig = {
  minifyScripts: async (js) => {
    const result = await transform(js, { minify: true, loader: 'js' });
    return result.code;
  },
};
```

Only applies to inline scripts (those without a `src` attribute) and to `.js` files copied into `dist/`. Non-JS script types such as `application/ld+json` are always left untouched.

### `obfuscateAttributeNames`

Hash the generated class and id names to short hex strings instead of the verbose `bascik__component__id__name` format. Recommended for production.

```js
obfuscateAttributeNames: true // production default
// bascik__my-nav__ab12cd34__navigation
// becomes: bab12cd34
```

### `cacheHttp`

Controls HTTP caching on server responses. Defaults to `false` in dev mode and `true` in `--serve` (production) mode, you rarely need to set this explicitly.

When `true`, HTML pages receive an `ETag` header and the server returns `304 Not Modified` for unchanged content. Static assets get `Cache-Control: public, max-age=3600`. When `false`, responses include `Cache-Control: no-store` so browsers always fetch fresh content.

Set `cacheHttp: false` explicitly when running `--serve` behind a CDN that manages its own caching.

### `serve`

Configure the HTTP/2 server started by `bascik --serve` and `bascik` (dev mode). `port`, `hostname`, `keyFile`, and `certFile` are read in both modes. `bascik --build` does not start a server and ignores this block.

```js
serve: {
  port: 8443,              // default
  hostname: 'localhost',   // default; set '0.0.0.0' to bind all interfaces
  keyFile: 'bascik-privkey.pem',  // path to TLS private key
  certFile: 'bascik-cert.pem',    // path to TLS certificate
}
```

See [Production Server](/server) for the full guide.

### `verboseLogging`

Include the `{ cause }` detail object in `console.warn` and `console.error` calls. Useful for debugging component processing errors.

```js
verboseLogging: false // default
```

### `siteUrl`

The canonical base URL of your deployed site (e.g. `'https://example.com'`). Required for sitemap generation. Trailing slashes are trimmed automatically.

```js
siteUrl: 'https://example.com'
```

### `generate`

Control which files are written to `dist/` during `bascik --build`. Both default to `true`. Requires `siteUrl` to be set.

```js
generate: {
  sitemap: true, // write dist/sitemap.xml
  robots: true,  // write dist/robots.txt
}
```

See [Sitemap & robots.txt](/sitemap) for a full walkthrough.

### `directory.watch`

An array of directories or files that, when changed in dev mode, trigger a full re-transpile of all pages. Useful for utility scripts, data files, or image directories that pages depend on at build time.

```js
directory: {
  pages: 'src/pages',
  components: 'src/components',
  watch: ['scripts/', 'data/'],
}
```

Has no effect during `bascik --build`.

### `inlineStyles`

Controls which global stylesheets Bascik reads and injects as `<style>` tags into every page's `<head>` during transpilation. When `minifyStyles` is true the content is minified before injection. Global styles are placed before component styles so component rules take precedence.

- `false`: inline nothing
- `true`: inline every `.css` file under `directory.pages`
- `string[]`: inline only the listed stylesheet paths

```js
inlineStyles: false // default
inlineStyles: true
inlineStyles: ['src/pages/css/styles.css']
```

This eliminates the render-blocking `<link rel="stylesheet">` request, the CSS arrives in the same HTTP response as the HTML. It pairs naturally with `buildOverrideConfig` to minify only in production:

```js
export const bascikConfig = {
  inlineStyles: ['src/pages/css/styles.css'],
  minifyStyles: false,
};

export const buildOverrideConfig = {
  minifyStyles: true,
};
```

> **When to inline.** Stylesheets under ~15 KB (gzipped) are good candidates. Larger stylesheets are better loaded asynchronously or split into critical and non-critical parts.

### `useWorkers`

Transpile pages across a pool of CPU-core worker threads instead of sequentially on the main thread.

```js
useWorkers: false // default
useWorkers: true
```

Spinning up the worker pool has a fixed cost, each worker loads the transpiler's module graph independently, which takes roughly 15-250ms in total depending on machine and cache state (all workers load in parallel, so this is a one-time fixed delay, not a per-page cost). For small sites, or sites without slow per-page work, this fixed cost outweighs the benefit of spreading pages across cores, and sequential transpilation on the main thread finishes first.

> **When to enable.** Turn this on for larger sites (dozens of pages or more) doing CPU-heavy work per page, complex CSS/JS scoping across many components. It will not help much on sites whose slow parts are I/O-bound (e.g. `<script data-bascik-build>` blocks that fetch data or spawn subprocesses), since that work is already asynchronous regardless of which thread initiates it.

## `buildOverrideConfig`

Exporting a second `buildOverrideConfig` object lets you set options that only apply during `bascik --build`, overriding the values in `bascikConfig`. A common pattern is to enable obfuscation and minification only in production:

```js
export const buildOverrideConfig = {
  obfuscateAttributeNames: true,
  minifyStyles: true,
  minifyScripts: true, // or a custom function for esbuild/terser
};
```
