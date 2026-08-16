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

Requires **Node.js ≥ 24**. The repo uses pnpm workspaces — one install at the root wires everything up.

```sh
pnpm install
```

`node_modules/@bascik/bascik` is symlinked directly to `pkg/`, so changes to `pkg/src/` are immediately available to the docs site after a rebuild — no pack or reinstall step.

### Working on the package

```sh
pnpm --filter @bascik/bascik build   # build the package (start here)
pnpm --filter @bascik/bascik test    # run unit tests
pnpm --filter @bascik/bascik e2e     # run e2e tests
pnpm --filter bascik-docs dev        # start docs dev server
```

After any `pkg/src/` change, rebuild the package and the docs server will pick it up automatically (it watches for changes).

### Updating Dynamic Documentation Assets

Before committing changes that edited source code, tests, or any `docs/content/*.md`, run this custom prompt:

```sh
/pre-commit
```

This regenerates `llms.txt`, updates `docs/src/pages/assets/SKILL.md` to reflect any new or changed content, copies it to `create/assets/SKILL.md`, and updates unit and E2E test coverage JSON files — all in one step.

The prompt calls:

- `pnpm --filter bascik-docs generate:llms`
- The LLM updates the `SKILL.md` file based on the `llms.txt` file.
- `pnpm --filter create-bascik prepack`
- `pnpm --filter @bascik/bascik update-coverage`
- `pnpm --filter @bascik/bascik update-e2e-coverage`
