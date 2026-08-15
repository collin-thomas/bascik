/**
 * nav.mjs — Single source of truth for docs navigation order.
 *
 * Imported by render-nav.mjs at build time. To add, remove, or reorder
 * pages, edit this file only — sidebar, pagination, and the top nav all
 * derive from it automatically.
 */

export const NAV = [
  { section: 'Philosophy', pages: [
    { href: '/why-bascik', label: 'Why Bascik' },
    { href: '/performance', label: 'Lighthouse 100s' },
    { href: '/vs-frameworks', label: 'Bascik vs Frameworks' },
  ]},
  { section: 'Start Here', pages: [
    { href: '/getting-started', label: 'Getting Started' },
    { href: '/cli', label: 'CLI / Command Line' },
    { href: '/configuration', label: 'Configuration' },
  ]},
  { section: 'Features', pages: [
    { href: '/scoped-styles', label: 'Scoped Styles' },
    { href: '/scoped-javascript', label: 'Scoped JavaScript' },
    { href: '/slots', label: 'Slots' },
    { href: '/props', label: 'Props' },
    { href: '/attribute-inheritance', label: 'Attribute Inheritance' },
    { href: '/build-scripts', label: 'Build Scripts' },
    { href: '/server', label: 'Production Server' },
    { href: '/sitemap', label: 'Sitemap & robots.txt' },
    { href: '/libraries', label: 'JavaScript Libraries' },
  ]},
  { section: 'Recipes', pages: [
    { href: '/recipes/markdown', label: 'Markdown' },
    { href: '/recipes/server-scripts', label: 'Server Scripts' },
    { href: '/recipes/templating', label: 'Templating' },
  ]},
  { section: 'Reference', pages: [
    { href: '/compatibility', label: 'Scoping Compatibility' },
    { href: '/faq', label: 'FAQ' },
    { href: '/agent-skill', label: 'Agent Skill' },
    { href: '/resources/vscode-extension', label: 'VS Code Extension' },
  ]},
  { section: 'Internals', pages: [
    { href: '/internals', label: 'Internals Overview' },
    { href: '/internals/architecture', label: 'Architecture' },
    { href: '/internals/transpilation-pipeline', label: 'Transpilation Pipeline' },
    { href: '/internals/scoping-system', label: 'Scoping System' },
    { href: '/internals/dev-server', label: 'Dev Server' },
    { href: '/internals/testing', label: 'Testing' },
    { href: '/internals/create-app', label: 'Create App' },
    { href: '/internals/vscode-extension', label: 'VS Code Extension' },
    { href: '/internals/ci-cd', label: 'CI / CD' },
  ]},
  { section: 'Switch to Bascik', pages: [
    { href: '/switch', label: 'Overview' },
    { href: '/switch/from-astro', label: 'From Astro' },
    { href: '/switch/from-eleventy', label: 'From Eleventy' },
    { href: '/switch/from-hugo', label: 'From Hugo' },
    { href: '/switch/from-next', label: 'From Next.js' },
    { href: '/switch/from-react', label: 'From React' },
    { href: '/switch/from-svelte', label: 'From Svelte' },
    { href: '/switch/from-vue', label: 'From Vue' },
  ]},
];
