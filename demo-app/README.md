# Bascik Demo App

A kitchen-sink demonstration of every Bascik feature, styled with the Bascik design system.

## Pages

| Route         | What it demonstrates                                                                  |
| ------------- | ------------------------------------------------------------------------------------- |
| `/`           | Hero, feature-card props, code-block component, live component demos                  |
| `/components` | Default slot, slot fallback, named slots, self-closing tags, props, nested components |
| `/styles`     | Scoped class names, scoped element selectors, `@media`, `@keyframes`                  |
| `/javascript` | `getElementById`, `querySelector`, IIFE isolation, build/dev script filtering         |
| `/about`      | Static page                                                                           |

## Components

All components live in `src/components/` and are built with the design system defined in `src/pages/css/styles.css`.

| Component      | Purpose                                                                      |
| -------------- | ---------------------------------------------------------------------------- |
| `demo-nav`     | Sticky navigation bar                                                        |
| `demo-footer`  | Page footer                                                                  |
| `feature-card` | Card driven by props (`label`, `title`, `desc`) and an optional default slot |
| `code-block`   | Styled code block; props: `lang` (default `html`), optional `file` label     |

## Development

Requires the `@bascik/bascik` package to be built first (`cd ../pkg && npm pack`).

```sh
# From the repo root
cd pkg && npm pack
cd ../demo-app
yarn install
yarn dev       # dev server at https://localhost:8443
yarn build     # write dist/
```

## Package Development (linked source)

For iterating on the framework alongside the demo:

```sh
cd demo-app
yarn pkg-dev   # watches pkg source directly via --watch-path
```
