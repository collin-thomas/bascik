# Getting Started

Bascik requires Node.js v24+. Get up and running in under five minutes.

## Quick Start

The fastest way to start a new Bascik project:

```sh
npm create bascik@latest
```

Enter a project name when prompted (or press Enter for `bascik-app`). The tool then asks two questions:

- **Install dependencies now?:** select Y to run `npm install` immediately
- **Start the dev server after install?:** select Y to launch the dev server right away

Select Y for both and you're live at **https://localhost:8443** with no further commands needed.

`npm create bascik@latest` scaffolds a complete starter site: pages, components, global CSS, `bascik.config.js`, and a `.gitignore`. If you prefer to set everything up manually, see [Manual Setup](#manual-setup) below.

## Starting the Dev Server

Run `npm run dev` (or `yarn dev`) to start the development server. Bascik serves your site over HTTP/2 at **https://localhost:8443** by default (the port auto-increments if 8443 is busy). It transpiles your pages, watches for changes, and live-reloads the browser on every save.

SSL certificates are generated automatically on first run. Install [mkcert](https://github.com/FiloSottile/mkcert) for a trusted cert with no browser warning:

```sh
# macOS
brew install mkcert
mkcert -install   # only needed once per machine
```

After running `mkcert -install`, restart the dev server. See the [CLI page](/cli) for more details on SSL certificate setup and browser-specific gotchas.

## Folder Structure

Bascik looks for two directories by default. Both can be overridden in [bascik.config.js](/configuration).

```text
src/
  components/  ← component .html and .css files
  pages/       ← one .html file per route
```

## Manual Setup

**For an existing project**, install Bascik with your preferred package manager:

```sh
npm install @bascik/bascik
# or
yarn add @bascik/bascik
# or
pnpm add @bascik/bascik
```

Run `bascik init` in your project directory to scaffold the starter files and folder structure automatically. If you prefer to wire things up yourself, add the following to your `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "bascik",
    "build": "bascik --build"
  }
}

<!-- demo:component-html -->
```html
<nav class="nav">
  <a href="/">Home</a>
  <a href="/about">About</a>
</nav>
```

<!-- demo:page-html -->
```html
<!DOCTYPE html>
<html>
<head><title>Home</title></head>
<body>
  <site-nav></site-nav>
  <h1>Hello world</h1>
</body>
</html>
```
