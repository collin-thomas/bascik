# Closed Beta Setup

## 1. Download the repo

```sh
git clone <repo-url>
cd bascik
yarn install
```

## 2. Link the local scaffold

```sh
cd create
npm install
npm link
```

## 3. Create your own site

```sh
cd ..
mkdir my-site && cd my-site
npx create-bascik my-site
```

## 4. Run the site

```sh
cd my-site
npm install
npm run dev
```

Open the URL it prints, usually:

```text
https://localhost:8443
```

## 5. Clean up after testing

Run from the `bascik/create` directory.

```sh
npm unlink
```

This removes the local link and returns the machine to the normal published package flow.
