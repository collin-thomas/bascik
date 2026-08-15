# Bascik

Bascik is a build tool for HTML components. It scopes and assembles reusable HTML component files into plain HTML pages at build time. Zero JavaScript is added to your pages.

HTML components.
Zero runtime.

**Documentation:** [bascik.dev](https://bascik.dev)  
**Package:** [`@bascik/bascik`](https://www.npmjs.com/package/@bascik/bascik)

---

## Repo Structure

| Directory   | Purpose                                                                            |
| ----------- | ---------------------------------------------------------------------------------- |
| `pkg/`      | The `@bascik/bascik` npm package — source, tests, benchmarks — see [pkg/README.md](pkg/README.md) |
| `create/`   | The `create-bascik` scaffolding CLI — `npm create bascik@latest` — see [create/README.md](create/README.md) |
| `docs/`     | Documentation site at [bascik.dev](https://bascik.dev) — built with Bascik itself |

---

## Development Setup

Requires **Node.js ≥ 24**. The repo uses yarn workspaces — one install at the root wires everything up.

```sh
yarn install
```

`node_modules/@bascik/bascik` is symlinked directly to `pkg/`, so changes to `pkg/src/` are immediately available to the docs site after a rebuild — no pack or reinstall step.

### Working on the package

```sh
yarn workspace @bascik/bascik build   # compile pkg/src/ → pkg/dist/
yarn workspace @bascik/bascik test    # run unit tests
```

### Developing against the docs site

```sh
yarn workspace @bascik/bascik build   # build pkg first
yarn --cwd docs dev                   # start docs dev server at https://localhost:8443
```

After any `pkg/src/` change, rebuild the package and the docs server will pick it up automatically (it watches for changes).

### Running the docs build

```sh
yarn --cwd docs build
```
