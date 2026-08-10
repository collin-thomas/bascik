# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **CSS `@scope` support** — class names in `@scope (.selector)` and `@scope (.selector) to (.selector)` arguments are now scoped by the global class-scoping pass. Class names and element selectors inside `@scope { }` blocks follow the same rules as other at-rules. This was already implicitly working; the compatibility documentation has been updated to reflect ✅ status.
- **Descendant element selectors after a class** (`Pass 4`) — `.card p {}`, `.list > li {}`, `.article > h2 {}` are now fully scoped. The element name is converted to a scoped class and injected onto matching HTML elements. This applies to any element selector preceded by a scoped class name with an optional combinator (`>`, `+`, `~`, or space). Bare element–element combinators (`div p {}`) still require a class anchor on the left side.

### Fixed

- `scopeCssCustomProperties`: `var(--prop, fallback)` references now correctly scope the property name even when a fallback value is present. Previously only `var(--prop)` (no fallback) was rewritten; any `var(--prop, fallback)` call was left with the unscoped name, silently causing the fallback to always be used.
- `injectProps`: the "strip remaining markers" step now only removes `data-bascik-prop-*` attributes that have **no value** (prop receivers inside the current component). Attributes with a value (e.g. `data-bascik-prop-label="featured"` on a child component tag) are preserved, so nested components correctly receive props passed through self-closing tags. Previously, the strip regex would partially match and corrupt child component usage tags (e.g. `<inner-badge data-bascik-prop-label="featured" />` became `<inner-badgel="featured" />`), causing `replaceTag` to fail to substitute the tag and leading to infinite recursion (stack overflow).

## [0.1.0] - 2026-07-25

### Added

**Components**

- HTML component system — define components as `.html` files, reference by tag name.
- Recursive component transpilation.
- Self-closing (void element) tag syntax: `<my-nav />` is equivalent to `<my-nav></my-nav>`.
- Custom props via `data-bascik-prop-*` attributes — pass text values from the usage site into component templates.
- Default slots via `<slot-component>` or `data-bascik-slot` (no value) — slot fallback content is rendered when no content is provided at the usage site.
- Named slots via `data-bascik-slot="name"` — inject content into specific zones of a component template, with fallback to the placeholder element's own inner content.
- Attribute inheritance — non-`data-bascik-*` attributes on a component usage tag (e.g. `class`, `aria-*`, `data-*`) are automatically merged onto the component's root element.
- `<head>` component support — components can now be used inside `<head>` to share `<meta>` tags, `<link>` elements, etc.

**Styles**

- Scoped CSS — class names, element selectors, `@media`, and `@keyframes` are namespaced per component instance.
- CSS custom properties scoping — `--var-name` declarations in a component's CSS file are automatically prefixed, and all `var(--var-name)` references are updated to match.
- CSS nesting selector scoping — element selectors in CSS nesting context (`& p {}`, `& > h2 {}`, `& + li {}`, `& ~ span {}`) are correctly scoped.
- CSS deduplication — each component's styles are injected into a page only once, even if the component is used multiple times.
- Built-in CSS minifier (`minifyStyles: true`) — strips comments, collapses whitespace, and removes spaces around structural characters. Enabled by default during `bascik --build`.

**JavaScript**

- Scoped JavaScript — `getElementById`, `getElementsByClassName`, `getElementsByName`, `querySelector(.class)`, `querySelectorAll(.class)`, `querySelector("#id")`, and `querySelectorAll("#id")` references are rewritten to match scoped attributes.
- Script block IIFE isolation.
- `<script type="module">` support — module scripts are excluded from IIFE wrapping but still have their DOM selector references rewritten.
- Build-only scripts `<script data-bascik-build>` — executed at transpile time as Node.js ESM modules; stdout is injected into the page in place of the script tag. Works in both page HTML and component files.
- Built-in JS minifier (`minifyScripts: true`) — strips comments and collapses whitespace while preserving string literals verbatim. Accepts a custom async function (e.g. backed by esbuild or terser) for production-quality output. Enabled by default during `bascik --build`.

**CLI**

- `bascik` — HTTP/2 development server with TLS (auto-generated self-signed certificate), in-memory page serving with Brotli compression, and smart live reload (reloads only the changed page; also fires on static asset changes).
- `bascik --build` — writes static output to `dist/`, copies non-HTML assets, and prints a compile-time summary (`✓ N pages transpiled in Xms`).
- `bascik --check` — static analysis that scans all pages and component files for unknown component tags (exits with code 1, suitable for CI) and unused component files (warnings only).

**Configuration** (`bascik.config.js`)

- `directory.pages` / `directory.components` — configure source directories.
- `obfuscateAttributeNames` — short hash-based class names in production builds.
- `verboseLogging` — toggles `{cause}` detail in `console.warn/error`.
- `deduplicateCss` — deduplicate component styles per page.
- `minifyStyles` — enable/disable built-in CSS minification.
- `minifyScripts` — enable/disable built-in JS minification, or supply a custom minifier function.
- `skipTranspilingElementContents` — tag names whose inner content is left untouched by the scoping pipeline. Defaults to `["code"]`.
- `inlineStyles` — stylesheet paths (relative to project root) to read and inline as `<style>` tags into every page's `<head>`.
- `triggerTranspile` — extra directories or files to watch in dev mode; changes trigger a full re-transpile.
- `siteUrl` — base URL used when generating sitemap and robots.txt.
- `generate.sitemap` / `generate.robots` — control whether `dist/sitemap.xml` and `dist/robots.txt` are written during `bascik --build`. Both default to `true`.
- `cacheHttp` — HTTP cache header control.

**Internals**

- Full TypeScript implementation with explicit types throughout.
- Comprehensive unit test suite — every library module has a corresponding `.test.ts` file.
- Unified component instance ID — a single random ID is shared across all attribute-scoping passes (`id`, `name`, `class`) for a given component instance.
- Windows path support — forward-slash-only regex patterns updated to `[\\/]`.
- Fully async I/O throughout (`access()` + dynamic `import()`, async `pki` operations).

### Fixed

- `<meta name="...">` attributes are shielded from name-attribute scoping so standard metadata vocabulary (e.g. `viewport`, `description`) is not rewritten.
- Unused `data-bascik-prop-*` marker attributes are stripped from the output even when no prop value is passed.
- `listPages()` uses `BascikConfig.directory.pages` instead of a hardcoded path.

[Unreleased]: https://github.com/collin-thomas/bascik/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/collin-thomas/bascik/releases/tag/v0.1.0
