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

Run `pnpm install` from the **repo root** (not this directory). The repo uses pnpm workspaces, so `@bascik/bascik` is symlinked directly to `pkg/` — no pack step needed.

```sh
# from repo root
pnpm install
pnpm --filter @bascik/bascik build   # build the package first
pnpm --filter bascik-docs dev        # dev server at https://localhost:8443
pnpm --filter bascik-docs build      # write dist/
```

## Package Development (linked source)

```sh
pnpm --filter bascik-docs pkg-dev   # watches pkg source directly via --watch-path
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
