## CLI

### `npm create bascik@latest` — scaffold a new project

```sh
npm create bascik@latest
# or: npm create bascik@latest my-project
```

Scaffolds a complete starter project in a new directory. Prompts for a project name if not passed as an argument. Creates:

```text
my-project/
  bascik.config.js
  package.json
  .gitignore
  src/
    pages/
      index.html
      about.html
      contact.html
      404.html
      css/
        styles.css
    components/
      site-meta/
      site-header/
      site-footer/
      feat-card/
      my-counter/
```

After scaffolding, the tool prompts you interactively:

```sh
✓ Scaffolded my-project/

Install dependencies now? (Y/n)
Start the dev server after install? (Y/n)
```

Select **Y** for both and you're live at `https://localhost:8443` with no extra commands.

### CLI reference

```sh
bascik          # dev: transpile, start HTTPS dev server, watch
bascik --build  # production: transpile to dist/ only
bascik --check  # static analysis: validate pages and components without building
```

### Starting the dev server

When you run `bascik`, Bascik transpiles your pages, generates local TLS certificates if needed, starts the built-in HTTP/2 server, and begins watching for changes.

Typical output:

```terminal
SSL: generated trusted certs via mkcert (run `mkcert -install` once if you haven't)

transpiled: pages/getting-started.html
transpiled: pages/index.html
transpiled: pages/about.html

✓ 3 pages transpiled in 45ms
Server running at https://localhost:8443
```

If [mkcert](https://github.com/FiloSottile/mkcert) is not installed, Bascik falls back to a self-signed certificate:

```terminal
SSL: self-signed cert generated (install mkcert for no browser warning)
transpiled: pages/index.html
✓ 1 page transpiled in 18ms
Server running at https://localhost:8443
```

If port `8443` is already in use, Bascik automatically tries the next available port:

```terminal
Port 8443 is in use, trying 8444…
Server running at https://localhost:8444
```

Certs are generated once and reused on subsequent starts. Delete `bascik-privkey.pem` and `bascik-cert.pem` to regenerate them.

### Watching for file changes

While the dev server is active, Bascik incrementally updates your build as files are added, updated, or removed.

- **Modifying or adding pages** rebuilds just that page:
  ```terminal
  transpiled: pages/about.html
  ```
- **Modifying components** rebuilds only the pages that use that component:
  ```terminal
  transpiled: pages/index.html
  transpiled: pages/about.html
  ```
- **Static assets** are copied into `dist/`:
  ```terminal
  copied: pages/css/custom.css
  ```
- **Deleting pages** removes the compiled output:
  ```terminal
  deleted file: pages/old-page.html
  ```

### Transpilation and build errors

If you introduce a syntax mistake or a build-script error, Bascik logs the file and location without crashing the dev server.

Component transpilation failure:

```terminal
[bascik] Transpilation failed for component <site-nav> during css-scoping in "pages/about.html" at (line 22, column 8)
  Defined in component template: "components/site-nav/site-nav.html"
  Error: ParseError: CSS Selector is invalid or could not be parsed.
```

Build script failure:

```terminal
[bascik] build script error in "pages/index.html" at (line 12, column 5):
ReferenceError: marked is not defined
```

Unknown component tag:

```terminal
[bascik] Unresolved component tag in "pages/about.html": <my-mistyped> — no matching component file found. Run `bascik --check` for a full report.
```

### Static analysis with `bascik --check`

Run `bascik --check` from your project root to validate all pages and component files without starting the dev server or writing any output files:

```sh
bascik --check
```

It reports:

- **Errors** — hyphenated tags that have no matching component file
- **Warnings** — component files that exist but are never referenced
- **Success** — exits with code `0` when no errors are found

Example output:

```terminal
[bascik check] ✓ 8 pages and 12 components checked — no errors
```

`bascik --check` exits with code `1` when errors are found, which makes it suitable for CI:

```sh
bascik --check && bascik --build
```

`bascik --check` does **not** validate CSS or JavaScript syntax. Use those tools immediately around it rather than treating them as a separate, later concern:

| Tool | What it catches | How to use |
|---|---|---|
| **VS Code built-in CSS** | CSS syntax errors in `.css` files | Enabled by default |
| **[Stylelint](https://stylelint.io)** | CSS syntax errors, invalid properties, custom conventions | `npm install -D stylelint && npx stylelint "**/*.css"` |
| **[HTMLHint](https://htmlhint.com)** | HTML structure errors in page and component `.html` files | `npm install -D htmlhint && npx htmlhint "src/**/*.html"` |
| **[ESLint](https://eslint.org)** | JavaScript syntax and logic errors in `.js` files | `npm install -D eslint && npx eslint "src/**/*.js"` |

For most teams, the most useful CI command sequence is:

```sh
npx stylelint "src/**/*.css" && bascik --check && bascik --build
```

### Production builds

Run `bascik --build` to write deployment-ready files to `dist/`:

```sh
bascik --build
```

The output uses root-relative asset paths (for example `/css/styles.css`) and must be served by an HTTP server. Opening files directly with `file://` will break stylesheet and script loading.

To preview the production build locally:

```sh
npx http-server dist
```

Then open the URL printed by `http-server` (default: `http://127.0.0.1:8080`).

### Editor setup and output inspection

**VS Code false positives.** Editors validate multiple `<script>` blocks in an HTML file as if they shared one scope. Bascik wraps each component script block in an IIFE at build time, so those editor warnings can be misleading. In VS Code, disable the project-level script validation:

```json
{
  "html.validate.scripts": false
}
```

**Inspect `dist/` directly.** Both the dev server and `bascik --build` write compiled HTML to `dist/` on disk. This is the fastest way to confirm what Bascik emitted:

- custom component tags should be gone
- scoped class names should be present where component CSS applies
- the page `<head>` should contain injected styles
- build-script output should already be inlined

> **MDN reference.** The CLI helps you build and inspect output, but the resulting HTML, CSS, and JavaScript are still standard web platform files. Keep [MDN's documentation](https://developer.mozilla.org/) close by when you need the canonical reference.
