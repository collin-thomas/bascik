## Configuration (`bascik.config.js`)

Create a `bascik.config.js` file in your project root to override any default settings.

### Full Example

```js
// bascik.config.js
export const bascikConfig = {
  // Source directories
  directory: {
    pages: 'src/pages',
    components: 'src/components',
  },

  // Feature flags
  scopeScriptBlocks: true,
  scopeAttribute: {
    class: true,
    id: true,
    name: true,
  },

  // CSS
  minifyStyles: true,            // remove whitespace from compiled CSS
  obfuscateAttributeNames: true, // hash class / id names in production

  // Server
  cacheHttp: false,

  // Logging
  verboseLogging: false, // include { cause } in console.warn/error
};

// Overrides applied only during `bascik --build`
export const buildOverrideConfig = {
  obfuscateAttributeNames: true,
  minifyStyles: true,
};
```

### Options Reference

#### `directory`

Paths to your pages and components directories. Relative to the project root.

```js
directory: {
  pages: 'src/pages',      // default
  components: 'src/components', // default
}
```

#### `scopeScriptBlocks`

Wrap component `<script>` tags in an IIFE and rewrite scoped attribute references. Set to `false` if you want raw unmodified script output.

```js
scopeScriptBlocks: true // default
```

#### `scopeAttribute`

Control which HTML attribute types are scoped independently. Useful if you're using Tailwind (`class: false`) or don't need name scoping.

```js
scopeAttribute: {
  class: true, // default
  id: true,    // default
  name: true,  // default
}
```

#### `minifyStyles`

Collapse whitespace and newlines in the injected `<style>` block. Defaults to `true`.

#### `obfuscateAttributeNames`

Hash the generated class and id names to short hex strings instead of the verbose `bascik__component__id__name` format. Recommended for production.

```js
obfuscateAttributeNames: true // production default
// bascik__my-nav__ab12cd34__navigation
// becomes: bab12cd34
```

#### `cacheHttp`

Enable HTTP cache headers on the dev server responses. Keep `false` during development.

#### `verboseLogging`

Include the `{ cause }` detail object in `console.warn` and `console.error` calls. Useful for debugging component processing errors.

```js
verboseLogging: false // default
```

### `buildOverrideConfig`

Exporting a second `buildOverrideConfig` object lets you set options that only apply during `bascik --build`, overriding the values in `bascikConfig`. A common pattern is to enable obfuscation and minification only in production:

```js
export const buildOverrideConfig = {
  obfuscateAttributeNames: true,
  minifyStyles: true,
};
```
