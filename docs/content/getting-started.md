# Getting Started

Bascik requires Node.js v24+. Get up and running in under five minutes.

## Quick Start

The fastest way to start a new Bascik project:

```sh
npm create bascik@latest
```

Enter a project name when prompted (or press Enter for `bascik-app`). The tool then asks two questions:

- **Install dependencies now?** — select Y to run `npm install` immediately
- **Start the dev server after install?** — select Y to launch the dev server right away

Select Y for both and you're live at **https://localhost:8443** — no further commands needed.

`npm create bascik@latest` scaffolds a complete starter site: pages, components, global CSS, `bascik.config.js`, and a `.gitignore`. If you prefer to set everything up yourself, see [Manual Setup](#manual-setup) below.

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

Run `npm run dev` (or `yarn dev`) to start the development server. Bascik serves your site over HTTP/2 at **https://localhost:8443** by default (the port auto-increments if 8443 is busy).

SSL certificates are generated automatically on first run. Install [mkcert](https://github.com/FiloSottile/mkcert) for a trusted cert with no browser warning:

```sh
# macOS — install mkcert and register the local CA with the system trust store
brew install mkcert
mkcert -install   # only needed once per machine
```

> **Firefox users.** Firefox maintains its own certificate store and ignores the macOS system trust store. Install `nss` (which provides `certutil`) **before** running `mkcert -install` so mkcert can register with Firefox automatically:
> ```sh
> brew install nss && mkcert -install
> ```
> If you already ran `mkcert -install` without `nss`, install `nss` and re-run `mkcert -install`.

After running `mkcert -install`, restart the dev server. Bascik will pick up mkcert automatically and generate a CA-trusted cert with no browser warning.

> **Already saw the browser warning?** If Bascik started before mkcert was installed, it will have generated cert files using `openssl` (the self-signed fallback). Bascik skips cert generation when the files already exist, so installing mkcert afterward has no effect until you delete the old files:
> ```sh
> rm bascik-cert.pem bascik-privkey.pem
> yarn dev   # bascik will now use mkcert
> ```

Without mkcert, Bascik falls back to `openssl` (pre-installed on macOS and Linux). Your browser will show a certificate warning — click through to proceed. Windows users without openssl can install it via `winget install ShiningLight.OpenSSL`.

## Folder Structure

Bascik looks for two directories by default. Both can be overridden in [bascik.config.js](/configuration).

```text
src/
  components/  ← component .html and .css files
  pages/       ← one .html file per route
```

## Custom 404 Page

If you create a `404.html` file in your pages directory (e.g. `src/pages/404.html`), Bascik's built-in development server will automatically serve it as a fallback for any non-existent routes with a `404` status code.

When you build your site for production (`bascik --build`), this file is compiled to `dist/404.html`, which is the standard location recognized by most static hosting providers (such as GitHub Pages, Netlify, Vercel, and Cloudflare Pages) to serve custom 404 pages.
