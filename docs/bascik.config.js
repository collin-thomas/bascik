export const bascikConfig = {
  directory: {
    pages: 'src/pages',
    components: 'src/components',
  },
  minifyStyles: false,
  obfuscateAttributeNames: false,
  scopeScriptBlocks: true,
  scopeAttribute: {
    class: true,
    id: true,
    name: true,
  },
  cacheHttp: false,
};

export const buildOverrideConfig = {
  minifyStyles: true,
  obfuscateAttributeNames: true,
};
