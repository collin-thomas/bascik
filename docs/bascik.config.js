export const bascikConfig = {
  directory: {
    pages: 'src/pages',
    components: 'src/components',
  },
  siteUrl: 'https://bascik.dev',
  triggerTranspile: ['scripts/'],
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
