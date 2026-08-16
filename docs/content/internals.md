# Internals Guide

Everything you need to work on the Bascik package itself, architecture, the transpilation pipeline, the scoping system, the dev server, and how to run the test suite.

## Repository Layout

The monorepo is split into two top-level folders:

```text
bascik/
  pkg/          ← the @bascik/bascik npm package
    src/
      index.ts        ← CLI entry point
      transpile.ts    ← dev/build startup (called by index.ts)
      lib/            ← all library modules
  docs/         ← this documentation site (a Bascik project itself)
```

The `pkg/` directory is a self-contained TypeScript project with its own `package.json`, `tsconfig.json`, and `vite.config.js` (used by Vitest).

## Quick Start for Contributors

You need Node.js v24 or later. Clone the repo and install dependencies from the root, pnpm workspaces wires everything up in one step:

```sh
git clone https://github.com/collin-thomas/bascik.git
cd bascik
pnpm install
```

Run the test suite:

```sh
pnpm --filter @bascik/bascik test
```

Build the package (compiles TypeScript to `pkg/dist/`):

```sh
pnpm --filter @bascik/bascik build
```

To work on the docs site with a live-reload dev server:

```sh
pnpm --filter @bascik/bascik build   # build pkg first
pnpm --filter bascik-docs dev        # https://localhost:8443
```

After any `pkg/src/` change, rebuild the package and the docs server will pick it up automatically.

## Internals Sub-pages

- [Architecture](/internals/architecture), module map, responsibilities, and how the files relate to one another.
- [Create App](/internals/create-app), how the standalone scaffolding CLI is structured and why the generated app uses npm.
- [Transpilation Pipeline](/internals/transpilation-pipeline), the two-phase page and component pipeline that turns source HTML into deployable output.
- [Scoping System](/internals/scoping-system), how IDs, class names, CSS, and JavaScript references are namespaced per component instance.
- [Dev Server](/internals/dev-server), the HTTP/2 server, TLS certificate generation, memory store, live reload, and watch system.
- [Testing](/internals/testing), running tests, coverage, writing new tests, and the benchmarking suite.
