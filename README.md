# Bascik

HTML components.
Zero runtime.

Bascik is a build tool for HTML components. It scopes and assembles reusable HTML component files into plain HTML pages at build time. Zero JavaScript is added to your pages.

**Documentation:** [bascik.dev](https://bascik.dev)  
**Package:** [`@bascik/bascik`](https://www.npmjs.com/package/@bascik/bascik)

---

## Repo Structure

| Directory   | Purpose                                                                            |
| ----------- | ---------------------------------------------------------------------------------- |
| `pkg/`      | The `@bascik/bascik` npm package — source, tests, benchmarks — see [pkg/README.md](pkg/README.md) |
| `create/`   | The `create-bascik` scaffolding CLI — `npm create bascik@latest` — see [create/README.md](create/README.md) |
| `extensions/vscode-bascik/` | The VS Code extension — see [extensions/vscode-bascik/README.md](extensions/vscode-bascik/README.md) |
| `docs/`     | Documentation site at [bascik.dev](https://bascik.dev) — built with Bascik itself |

---

## Development Setup

Requires **Node.js ≥ 22.18** and **Yarn ≥ 4** (pinned to `yarn@4.6.0` in `package.json`). The repo uses Yarn workspaces, one install at the root wires everything up.

```sh
corepack enable
yarn install
```

`node_modules/@bascik/bascik` is symlinked directly to `pkg/`, so changes to `pkg/src/` are immediately available to the docs site after a rebuild — no pack or reinstall step.

### Working on the package

```sh
yarn pkg:build      # build the package (start here)
yarn pkg:typecheck  # TypeScript type check
yarn pkg:e2e        # run e2e tests
yarn pkg:test       # unit tests in watch mode
yarn docs:dev       # start docs dev server
```

After any `pkg/src/` change, rebuild the package and the docs server will pick it up automatically (it watches for changes).

### Updating Dynamic Documentation Assets

Before committing changes that edited source code, tests, or any `docs/content/*.md`, run this custom prompt:

```sh
/pre-push
```

This updates test coverage JSON files, builds docs (generating `llms.txt` and search index), updates `docs/src/pages/assets/SKILL.md` to reflect any new or changed content, and copies it to `create/assets/SKILL.md` — all in one step.

The prompt calls:

- `yarn docs:update-coverage`
- `yarn docs:update-e2e-coverage`
- `yarn docs:build`
- The LLM updates the `SKILL.md` file based on changes in `docs/content/`.
- `yarn create:prepack`
