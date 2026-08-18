## Folder Structure & Static Assets

Bascik projects use two main directories by default:

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
      app.js            → dist/js/app.js (auto-minified)
    images/
      logo.svg          → dist/images/logo.svg
      hero.webp         → dist/images/hero.webp
    blog/
      first-post.html   → dist/blog/first-post.html
```

### Static Assets and Custom Directories in `src/pages/`

You can organize your assets into **any custom folder structure** inside `src/pages/` (such as `css/`, `js/`, `images/`, `fonts/`, `downloads/`, or nested subdirectories like `blog/images/`).

Bascik automatically handles static assets in `src/pages/`:

- **HTML templates (`.html`)**: Transpiled into HTML pages with components resolved and scoped.
- **CSS files (`.css`)**: Replicated to `dist/` and minified at build time if `minify.css` is enabled.
- **JavaScript files (`.js`)**: Replicated to `dist/` and minified at build time if `minify.js` is enabled.
- **Binary / Media assets (`.png`, `.jpg`, `.svg`, `.webp`, `.woff2`, `.pdf`, etc.)**: Copied as-is to `dist/` with directory structure intact.

No passthrough copy list or asset bundler configuration is required.

### Custom 404 Page

If you create a `404.html` file in your pages directory (e.g. `src/pages/404.html`), Bascik's built-in development server will automatically serve it as a fallback for any non-existent routes with a `404` status code.

When you build your site for production (`bascik --build`), this file is compiled to `dist/404.html`, which is the standard location recognized by most static hosting providers (such as GitHub Pages, Netlify, Vercel, and Cloudflare Pages) to serve custom 404 pages.

