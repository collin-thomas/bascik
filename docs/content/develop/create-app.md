# Create App

The `create/` folder is a small standalone package that scaffolds a fresh Bascik project. It is separate from the main package because it is meant to be run as a user-facing CLI, not as a workspace dependency.

## Why it is separate

The repo root uses Yarn workspaces. The package code lives in `pkg/`, while the scaffold lives in `create/` and is installed like a normal Node tool.

That split keeps the monorepo dev flow simple and keeps the generated project familiar for normal users.

## What the CLI does

The generator in `create/src/index.ts` asks for a project name, validates it, and then calls the project scaffold in `create/src/scaffold.ts`.

It writes a standard starter project with:

- `package.json`
- `bascik.config.js`
- `.gitignore`
- `src/pages/`
- `src/components/`
- base global CSS and starter HTML

Then it offers to install dependencies and start the dev server.

## Why the generated app uses npm

The generated app is a normal Node project. The scaffold runs `npm install` and `npm run dev` after creation so users do not need Yarn to get started.

This is intentional. The repo itself uses Yarn workspaces for contributor work, but the generated site is designed to feel like a regular app created with a standard Node CLI.

## Local repo flow

If you want to test the generator from this repo, the flow is:

```sh
cd bascik/create
npm install
npm link

mkdir my-project && cd my-project
npx create-bascik my-project
```

Then the new app starts with:

```sh
npm install
npm run dev
```

The generated app is still a normal Bascik project after that. It does not depend on the repo workspace layout.

## Cleanup after local testing

`npm link` is useful while you are actively testing the local CLI. Once you are done, unlink it to return to the normal published package flow and keep your machine clean.

```sh
cd bascik/create
npm unlink
```

This is a good cleanup step after a beta or after local validation is complete. If you are still actively iterating on the generator, leaving it linked is fine.
