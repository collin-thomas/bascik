export const bascikConfig = {
  directory: {
    pages: 'src/pages',
    components: 'src/components',
    watch: ['scripts/', 'content/', '../pkg/test-coverage.json', '../pkg/e2e-test-coverage.json'],
  },
  siteUrl: 'https://bascik.dev',
  inlineStyles: ['src/pages/css/styles.css'],
  minifyStyles: false,
  obfuscateAttributeNames: false,
  scopeScriptBlocks: true,
  inheritAttributes: true,
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
  minifyScripts: async (js) => {
    const { transform } = await import('esbuild');
    const result = await transform(js, { minify: true, loader: 'js' });
    return result.code;
  },
};
