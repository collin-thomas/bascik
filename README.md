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

### Local Development Setup

Because this repo does not store the packaged tarball, run the local package build and pack step when you want to run `demo-app` or `docs` from source.

This is mainly for repo-local development and when `pkg/` changes; normal package consumers install `@bascik/bascik` from npm instead.

```sh
cd pkg
yarn install
yarn build
npm pack
cd ../demo-app
yarn cache clean
rm yarn.lock
yarn
yarn dev
```

### Install docs and demo-app dependencies

Requires **Node.js ≥ 24.17.0**.

If you are running the repo locally, build and pack the package once before installing the sites.

```sh
cd pkg
yarn install
yarn build
npm pack
cd ../docs
yarn install
cd ../demo-app
yarn install
```

---

See [pkg/README.md](pkg/README.md) for tests, publishing steps, and internals documentation.
