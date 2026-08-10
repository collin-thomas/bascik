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
| `/configuration`     | Full `bascik.config.js` reference with `buildOverrideConfig`             |

## Components

| Component     | Purpose                                                             |
| ------------- | ------------------------------------------------------------------- |
| `docs-nav`    | Sticky top navigation                                               |
| `docs-footer` | Page footer                                                         |
| `code-block`  | Syntax-highlighted code block; props: `lang`, optional `file` label |

## Development

Requires the `@bascik/bascik` package to be built first (`cd ../pkg && npm pack`).

```sh
cd pkg && npm pack
cd ../docs
yarn install
yarn dev       # dev server at https://localhost:8443
yarn build     # write dist/
```

## Package Development (linked source)

```sh
cd docs
yarn pkg-dev   # watches pkg source directly via --watch-path
```

## Design

The docs site shares the same color palette as the demo app:

```
background:  #18191b
accent:      #d3ff8d
text:        #f0f1f2
text-muted:  #7c8290
```

The layout uses a sidebar on desktop (`docs-layout` CSS grid) that collapses to a single column on mobile.
