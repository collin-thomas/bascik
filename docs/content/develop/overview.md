<p class="section-label">Internals</p>

# Internals Guide

<p class="page-intro">Everything you need to work on the Bascik package itself — architecture, the transpilation pipeline, the scoping system, the dev server, and how to run the test suite.</p>

## Repository Layout

The monorepo is split into two top-level folders:

```text
bascik/
  pkg/          ← the @bascik/bascik npm package
    src/
      transpile.ts    ← CLI entry point
      lib/            ← all library modules
  docs/         ← this documentation site (a Bascik project itself)
```

The `pkg/` directory is a self-contained TypeScript project with its own `package.json`, `tsconfig.json`, and `vite.config.js` (used by Vitest).

## Quick Start for Contributors

You need Node.js v24 or later. Clone the repo and install dependencies:

```sh
git clone https://github.com/collin-thomas/bascik.git
cd bascik/pkg
yarn install
```

Run the test suite:

```sh
yarn test
```

Build the package (compiles TypeScript to `dist/`):

```sh
yarn build
```

To work on the docs site with a live-reload dev server:

```sh
cd ../docs
yarn install
yarn dev
```

## Internals Sub-pages

- [Architecture](/develop/architecture) — module map, responsibilities, and how the files relate to one another.
- [Transpilation Pipeline](/develop/transpilation-pipeline) — the two-phase page and component pipeline that turns source HTML into deployable output.
- [Scoping System](/develop/scoping-system) — how IDs, class names, CSS, and JavaScript references are namespaced per component instance.
- [Dev Server](/develop/dev-server) — the HTTP/2 server, TLS certificate generation, memory store, live reload, and watch system.
- [Testing](/develop/testing) — running tests, coverage, writing new tests, and the benchmarking suite.
