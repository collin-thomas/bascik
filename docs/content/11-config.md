## Configuration (`bascik.config.js`)

```js
export const bascikConfig = {
  directory: {
    pages: "src/pages", // default
    components: "src/components", // default
  },
  scopeScriptBlocks: true,
  scopeAttribute: {
    class: true,
    id: true,
    name: true,
  },
  minifyStyles: true,
  obfuscateAttributeNames: true, // hash class/id names to short hex strings
  cacheHttp: false,
  verboseLogging: false,
};

// Applied only during `bascik --build`, merged over bascikConfig
export const buildOverrideConfig = {
  obfuscateAttributeNames: true,
  minifyStyles: true,
};
```
