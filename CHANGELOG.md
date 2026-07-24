# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-07-24

### Added

**Components**

- Self-closing (void element) tag syntax: `<my-nav />` is equivalent to `<my-nav></my-nav>`.
- Custom props via `data-bascik-prop-*` attributes — pass text values from the usage site into component templates.
- Slot fallback content — `<slot-component>default</slot-component>` and `<div data-bascik-slot>default</div>` render their own inner content when no slot content is provided at the usage site.
- Named slots via `data-bascik-slot="name"` — inject content into specific zones of a component template.
- Named slot fallback content — unfilled named slots now fall back to the placeholder element's own inner content.
- `data-bascik-slot` (no value) as an alternative default-slot convention, replacing the older `<slot-component>` tag (backward compatible).
- Attribute inheritance — non-`data-bascik-*` attributes on a component usage tag (e.g. `class`, `aria-*`, `data-*`) are automatically merged onto the component's root element.
- `<head>` component support — components can now be used inside `<head>` to share `<meta>` tags, `<link>` elements, etc.

**Styles**

- CSS custom properties scoping — `--var-name` declarations in a component's CSS file are automatically prefixed, and all `var(--var-name)` references are updated to match.

**JavaScript**

- `querySelector("#id")` and `querySelectorAll("#id")` selector rewriting added alongside the existing `getElementById` pattern.
- Build-only scripts `<script data-bascik-build>` — included only in production builds.
- `<script type="module">` support — module scripts are excluded from IIFE wrapping but still have their DOM selector references rewritten.

**Developer Experience**

- Live reload now fires when a static asset (CSS, images, etc.) is changed — not just on HTML/component changes.
- Compile-time summary printed after `processAllPages`: `✓ N pages transpiled in Xms`.
- `verboseLogging` config option — toggles `{cause}` detail in `console.warn/error`.
- Unified component instance ID — a single random ID is shared across all attribute-scoping passes (`id`, `name`, `class`) for a given component instance, replacing the previous per-pass IDs.

**Internals**

- `listPages()` now uses `BascikConfig.directory.pages` instead of a hardcoded `"./pages"` path.
- Windows path support — forward-slash-only regex patterns updated to `[\\/]`.
- CSS deduplication — each component's styles are injected into a page only once, even if the component is used multiple times.
- `userConfig.js` converted from sync `existsSync` + CJS `require()` to fully async `access()` + dynamic `import()`.
- `pki.js` converted from `existsSync`/`execSync`/`rmSync` to fully async equivalents.
- `transpile.js` no longer uses `createRequire` to load `http2.js`.

### Fixed

- Unused `data-bascik-prop-*` marker attributes are now stripped from the output even when no prop value is passed.

## [0.1.0] - 2026-01-01

### Added

- Initial release.
- HTML component system — define components as `.html` files, reference by tag name.
- Recursive component transpilation.
- Default slots via `<slot-component>`.
- Scoped CSS — class names, element selectors, `@media`, and `@keyframes` are namespaced per component instance.
- Scoped JavaScript — `getElementById`, `getElementsByClassName`, `getElementsByName`, `querySelector(.class)`, `querySelectorAll(.class)` references rewritten to match scoped attributes.
- Script block IIFE isolation.
- HTTP/2 development server with TLS (auto-generated self-signed certificate).
- In-memory page serving with Brotli compression.
- Smart live reload — reloads only the page that was changed.
- `bascik --build` writes static output to `dist/`.
- `bascik.config.js` for opt-in configuration.
- Class-name obfuscation (`obfuscateAttributeNames`) for production builds.
- CSS minification.
- 404 page handling.
- Sub-directory support for both pages and components.
- Non-HTML asset copying (images, CSS, etc.) to `dist/`.
- File-hash comparison to avoid needless disk I/O.

[Unreleased]: https://github.com/collin-thomas/bascik/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/collin-thomas/bascik/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/collin-thomas/bascik/releases/tag/v0.1.0
