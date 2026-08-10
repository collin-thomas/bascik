/**
 * Bascik config for the e2e fixture site.
 *
 * Obfuscation is intentionally disabled so Playwright assertions can match
 * readable scoped names like `bascik__scope-test__active` rather than
 * opaque hashes. All scoping features remain fully active.
 */
export const bascikConfig = {
  directory: {
    pages: 'src/pages',
    components: 'src/components',
  },
  obfuscateAttributeNames: false,
  minifyStyles: false,
  scopeScriptBlocks: true,
  scopeAttribute: {
    class: true,
    id: true,
    name: true,
  },
};
