# Bascik

A static site generator that lets you write reusable HTML components. No JavaScript framework — plain HTML, CSS, and JavaScript, compiled at build time. Zero JavaScript added to your pages.

**Documentation:** [bascik.dev](https://bascik.dev)  
**Package:** [`@bascik/bascik`](https://www.npmjs.com/package/@bascik/bascik)

---

## Repo Structure

| Directory   | Purpose                                                                            |
| ----------- | ---------------------------------------------------------------------------------- |
| `pkg/`      | The `@bascik/bascik` npm package — source, tests, benchmarks                      |
| `demo-app/` | Kitchen-sink demo site showing every feature                                       |
| `docs/`     | Documentation site at [bascik.dev](https://bascik.dev) — built with Bascik itself |

---

## Working on the Package

Requires **Node.js ≥ 24**.

```sh
cd pkg
yarn install
```

### Developing Against the Demo App

Link the local package so changes in `pkg/src/` reflect immediately:

```sh
cd demo-app
yarn link @bascik/bascik
yarn pkg-dev
```

### Simulating a Packed Install

Test the actual published artifact before releasing:

```sh
cd pkg && npm pack
cd ../demo-app
yarn cache clean
yarn add ../pkg/bascik-bascik-X.Y.Z.tgz
yarn dev
```

---

See [pkg/README.md](pkg/README.md) for tests, publishing steps, and internals documentation.
