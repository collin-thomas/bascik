## Getting Started

Bascik requires Node.js v24+. Get up and running in under five minutes.

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
