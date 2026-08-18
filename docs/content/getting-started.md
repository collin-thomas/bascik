# Getting Started

Bascik requires Node.js v22.18+. Get up and running in under five minutes.

## Quick Start

The fastest way to start a new Bascik project with no prompts, just a running site:

```sh
npm create bascik@latest my-site -y
```

That scaffolds the project, installs dependencies, and starts the dev server in one shot. You're live at **http://localhost:8080**.

Pass a different name to use it as both the directory name and the site title. If you omit the name, the tool prompts for one (defaulting to `bascik-app`). Drop `-y` to step through the install and dev server prompts manually.

`npm create bascik@latest` scaffolds a complete starter site: pages, components, global CSS, `bascik.config.ts`, and a `.gitignore`. If you prefer to set everything up manually, see [Manual Setup](#manual-setup) below.

## Starting the Dev Server

Run `npm run dev` (or `yarn dev` / `pnpm dev`) to start the development server. Bascik serves your site over HTTP/1.1 at **http://localhost:8080** by default (the port auto-increments if 8080 is busy). It transpiles your pages, watches for changes, and live-reloads the browser on every save.

If you opt into secure local HTTPS with HTTP/2 (`enableTls: true` in your `bascik.config.ts`), SSL certificates are generated automatically on first run. Install [mkcert](https://github.com/FiloSottile/mkcert) for a trusted cert with no browser warning:

```sh
# macOS
brew install mkcert
mkcert -install   # only needed once per machine
```

After running `mkcert -install`, restart the dev server. See the [CLI page](/cli) for more details on SSL certificate setup and browser-specific gotchas.

## Folder Structure & Static Assets

Bascik looks for two main directories by default. Both can be customized in [bascik.config.ts](/configuration).

```text
src/
  components/           ← component .html (+ optional .css) templates
  pages/                ← HTML routes, static assets, and subfolders
    index.html          → dist/index.html
    about.html          → dist/about.html
    404.html            → dist/404.html
    css/
      styles.css        → dist/css/styles.css (auto-minified)
    js/
      main.js           → dist/js/main.js (auto-minified)
    images/
      logo.svg          → dist/images/logo.svg
      hero.webp         → dist/images/hero.webp
    blog/
      first-post.html   → dist/blog/first-post.html
```

### Subdirectories and Assets in `src/pages/`

You can create **any folder structure** and place **any asset type** inside `src/pages/`. Bascik treats `src/pages/` as the single unified source tree for both page routes and static files:

- **HTML files (`.html`)**: Transpiled by Bascik (resolving component tags, scoping CSS and JS, executing build scripts) and emitted to `dist/` at the matching path.
- **CSS files (`.css`)**: Copied to `dist/` preserving their folder structure. Automatically minified during `bascik --build` when `minifyStyles` is enabled (the default).
- **JavaScript files (`.js`)**: Copied to `dist/` preserving their folder structure. Automatically minified during `bascik --build` when `minifyScripts` is enabled (the default).
- **Static assets (images, fonts, PDFs, JSON, etc.)**: Any non-`.html` file (such as `.png`, `.jpg`, `.svg`, `.webp`, `.woff2`, `.pdf`) is copied as-is to `dist/` maintaining its exact subfolder structure.

No asset pipelines, passthrough copy configuration, or public folder settings are required.

### Custom 404 Page

Create `src/pages/404.html` to define a custom error page. During development (`npm run dev`), Bascik's server automatically serves `404.html` for any missing route. On build (`bascik --build`), it outputs to `dist/404.html`, which static hosts like GitHub Pages, Netlify, Cloudflare Pages, and Vercel pick up automatically.

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
```

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
