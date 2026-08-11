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
  { section: 'Reference', pages: [
    { href: '/compatibility', label: 'Scoping Compatibility' },
    { href: '/copilot-skill', label: 'AI Skill' },
  ]},
  { section: 'Recipes', pages: [
    { href: '/using-markdown', label: 'Using Markdown' },
  ]},
  { section: 'Migration', pages: [
    { href: '/migrate', label: 'Migration Overview' },
    { href: '/migrate/from-react', label: 'From React' },
    { href: '/migrate/from-next', label: 'From Next.js' },
    { href: '/migrate/from-eleventy', label: 'From Eleventy' },
    { href: '/migrate/from-astro', label: 'From Astro' },
    { href: '/migrate/from-hugo', label: 'From Hugo' },
  ]},
  { section: 'Internals', pages: [
    { href: '/develop', label: 'Internals Overview' },
    { href: '/develop/architecture', label: 'Architecture' },
    { href: '/develop/transpilation-pipeline', label: 'Transpilation Pipeline' },
    { href: '/develop/scoping-system', label: 'Scoping System' },
    { href: '/develop/dev-server', label: 'Dev Server' },
    { href: '/develop/testing', label: 'Testing' },
  ]},
];
