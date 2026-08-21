# Bascik Docs

The official Bascik documentation site — built with Bascik itself.

## Pages

| Route                | Content                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| `/`                  | Overview and feature index                                               |
| `/getting-started`   | Installation, folder structure, first component, dev + build scripts     |
| `/slots`             | Default slot, `data-bascik-slot`, slot fallback content, named slots     |
| `/props`             | `data-bascik-prop-*` — injecting text values into component templates    |
| `/scoped-styles`     | CSS file pairing, class scoping, element scoping, `@media`, `@keyframes` |
| `/scoped-javascript` | IIFE isolation, ID/class selector rewriting, build/dev-only scripts      |
| `/configuration`     | Full `bascik.config.ts` reference with `buildOverrideConfig`             |

## Components

| Component     | Purpose                                                             |
| ------------- | ------------------------------------------------------------------- |
| `docs-nav`    | Sticky top navigation                                               |
| `docs-footer` | Page footer                                                         |
| `code-block`  | Syntax-highlighted code block; props: `lang`, optional `file` label |

## Development

Run `yarn install` from the **repo root** (not this directory). The repo uses Yarn workspaces, so `@bascik/bascik` is symlinked directly to `pkg/`, so no pack step is needed.

```sh
# from repo root
corepack enable
yarn install
yarn pkg:build                       # build the package first
yarn docs:dev                        # dev server at http://localhost:8080
yarn docs:build                      # write dist/
yarn docs:typecheck                  # TypeScript type check
yarn docs:unit                       # Vitest unit tests
yarn docs:e2e                        # Playwright E2E tests
yarn docs:lighthouse                 # Lighthouse CLI performance and accessibility audits
yarn docs:coverage                   # unit tests with coverage report
```

## Package Development (linked source)

```sh
yarn workspace bascik-docs pkg-dev   # watches pkg source directly via --watch-path
```

## Design

The docs site shares the same color palette as the demo app:

```text
background:  #18191b
accent:      #d3ff8d
text:        #f0f1f2
text-muted:  #7c8290
```

The layout uses a sidebar on desktop (`docs-layout` CSS grid) that collapses to a single column on mobile.
