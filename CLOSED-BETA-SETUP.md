# Closed Beta Setup

## 1. Install the repo

Once you've cloned this repo, cd into it and install the dependencies.

```sh
yarn install
```

## 2. Link the local scaffold

```sh
cd create
npm install
npm link
```

## 3. Create your own site

The `-y` flag skips both prompts. The npm install will print a 404 error for `@bascik/bascik` (not on npm yet), but the dev server will still start because the workspace `node_modules` resolves the package.

```sh
cd ..
npx create-bascik my-site -y
```

Command+Click the URL to open the site.

```text
Server running at https://localhost:8443
```

## Clean up after testing

Run from the `bascik/create` directory.

```sh
npm unlink
```

This removes the local link and returns the machine to the normal published package flow.
