## Getting Started

### Installation

Install Bascik with your preferred package manager:

```sh
yarn add @bascik/bascik
# or
npm install @bascik/bascik
# or
pnpm add @bascik/bascik
```

### Project Setup

Add the Bascik scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "bascik",
    "build": "bascik --build"
  }
}
```

Run `yarn dev` (or `npm run dev`) to start the development server. Bascik serves your site over HTTP/2 at **https://localhost:8443** by default (the port auto-increments if 8443 is busy).

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

### Folder Structure

Bascik looks for two directories by default. Both can be overridden in [bascik.config.js](/configuration).

```text
src/
  components/  ← component .html and .css files
  pages/       ← one .html file per route
```

### Custom 404 Page

If you create a `404.html` file in your pages directory (e.g. `src/pages/404.html`), Bascik's built-in development server will automatically serve it as a fallback for any non-existent routes with a `404` status code.

When you build your site for production (`bascik --build`), this file is compiled to `dist/404.html`, which is the standard location recognized by most static hosting providers (such as GitHub Pages, Netlify, Vercel, and Cloudflare Pages) to serve custom 404 pages.
