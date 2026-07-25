## CLI

```sh
bascik          # dev: transpile, start HTTP/2 server at https://localhost:8443, watch
bascik --build  # production: transpile to dist/ only
bascik --check  # static analysis: validate pages and components without building
```

### Development Workflow & Server Output

Bascik's command-line interface is designed to provide clean, minimal, and informative terminal output. Here is what you will see in your terminal during development.

#### 1. Starting the Dev Server
When you start the dev server, Bascik automatically generates local SSL/TLS certificates for its built-in HTTP/2 server, transpiles all pages inside your pages directory, and begins watching for changes:

```terminal
SSL: generated trusted certs via mkcert (run `mkcert -install` once if you haven't)
Server running at https://localhost:8443

transpiled: pages/getting-started.html
transpiled: pages/index.html
transpiled: pages/about.html

✓ 3 pages transpiled in 45ms
```

If [mkcert](https://github.com/FiloSottile/mkcert) is not installed, Bascik falls back to a self-signed certificate (browsers will show a security warning until you accept the exception):

```terminal
SSL: self-signed cert generated (install mkcert for no browser warning)
Server running at https://localhost:8443
```

If port 8443 is already in use, Bascik automatically tries the next available port:

```terminal
Port 8443 is in use, trying 8444…
Server running at https://localhost:8444
```

Certs are generated once and reused on subsequent starts. Delete `bascik-privkey.pem` and `bascik-cert.pem` to regenerate them (e.g. to upgrade from a self-signed cert to a mkcert-trusted one after installing mkcert).

#### 2. Watching for File Changes (Watch Mode)
While the dev server is active, Bascik watches your file system and incrementally updates your build as files are added, updated, or removed:

* **Modifying/Adding Pages:** Editing or adding an HTML page in your pages directory (e.g., `src/pages/about.html`) triggers incremental transpilation of just that page:
  ```terminal
  transpiled: pages/about.html
  ```
* **Modifying Components:** Editing a component (e.g., `src/components/site-nav/site-nav.html`) triggers selective transpilation. Bascik tracks dependency mappings and only rebuilds pages that actually reference that component:
  ```terminal
  transpiled: pages/index.html
  transpiled: pages/about.html
  ```
* **Static Assets:** Replicating any non-HTML static assets (like custom CSS, JS files, or images) from pages directly into the output directory:
  ```terminal
  copied: /Users/collin/github/bascik/docs/src/pages/css/custom.css
  ```
* **Deleting Pages:** Removing a page from your pages directory automatically cleans up its compiled output counterpart to prevent dead files:
  ```terminal
  deleted file: /Users/collin/github/bascik/docs/src/pages/old-page.html
  ```

#### 3. Transpilation & Build Errors
If you introduce a syntax mistake or a runtime error inside a custom build script, Bascik prevents the server from crashing, gracefully logs a descriptive error with the file and exact line/column location, and continues running.

* **Component Transpilation Failure:** If a component markup or CSS scoping parser fails during transpilation:
  ```terminal
  [bascik] Transpilation failed for component <site-nav> during css-scoping in "pages/about.html" at (line 22, column 8)
    Defined in component template: "components/site-nav/site-nav.html"
    Error: ParseError: CSS Selector is invalid or could not be parsed.
  ```
* **Build Script Failure:** If a build-time JavaScript execution block (using `<script data-bascik-build>`) encounters an error:
  ```terminal
  [bascik] build script error in "pages/index.html" at (line 12, column 5):
  ReferenceError: marked is not defined
  ```
* **Unknown Component Tags:** If a page references a hyphenated tag with no matching component file, Bascik warns during transpilation:
  ```terminal
  [bascik] Unresolved component tag in "pages/about.html": <my-mistyped> — no matching component file found. Run `bascik --check` for a full report.
  ```

#### 4. Static Analysis (`bascik --check`)
Run `bascik --check` from your project root to validate all pages and component files without starting the dev server or writing any output files:

```terminal
bascik --check
```

Bascik will scan every `.html` file in your pages and components directories and report:

* **Errors** — hyphenated tags that have no matching component file (causes the tag to render as-is in the output):
  ```terminal
  [bascik check] Unknown component in "pages/about.html": <my-missing> — no matching component file found
  ```
* **Warnings** — component files that exist but are never referenced in any page or other component:
  ```terminal
  [bascik check] Unused component: <old-widget> — defined but never referenced
  ```
* **Success** — exits with code `0` when no errors are found (unused warnings are still printed):
  ```terminal
  [bascik check] ✓ 8 pages and 12 components checked — no errors
  ```

`bascik --check` exits with code `1` when errors are found, making it suitable for use in CI pipelines:

```sh
# In a CI script:
bascik --check && bascik --build
```

> **What `bascik --check` does not cover.** The check validates component references — unknown and unused tags. It does not parse CSS or JavaScript for syntax errors. If a CSS file contains a syntax error (for example, a value accidentally split across two lines), Bascik's scoping transforms may still run on the malformed input and produce unexpected output. Complement `bascik --check` with the tools below to catch these cases before they reach your build.

#### Recommended Complementary Analysis Tools

These tools run independently of Bascik and are not required, but they close the gap that `bascik --check` does not cover:

| Tool | What it catches | How to use |
|---|---|---|
| **VS Code built-in CSS** | CSS syntax errors (squiggly lines in `.css` files in the editor) | Enabled by default — no install needed |
| **[Stylelint](https://stylelint.io)** | CSS syntax errors, invalid properties, rule ordering, custom conventions | `npm install -D stylelint && npx stylelint "**/*.css"` |
| **[HTMLHint](https://htmlhint.com)** | HTML structure errors in page and component `.html` files | `npm install -D htmlhint && npx htmlhint "src/**/*.html"` |
| **[ESLint](https://eslint.org)** | JavaScript syntax and logic errors in component `<script>` blocks | `npm install -D eslint && npx eslint "src/**/*.js"` |

Adding a Stylelint step to CI is the most effective single addition for catching CSS issues that affect Bascik's scoping output:

```sh
# CI pipeline with CSS and component validation:
npx stylelint "src/**/*.css" && bascik --check && bascik --build
```

#### Editor Configuration

Editors validate `<script>` blocks in an HTML file as if they all share one scope. This causes false "variable already declared" errors when the same variable name appears in two different script blocks — even though Bascik wraps each block in an IIFE at build time, keeping their scopes completely isolated.

**VS Code** ships with a built-in HTML script validator that triggers this. Disable it for your project by adding a `.vscode/settings.json` file:

```json
{
  "html.validate.scripts": false
}
```

This suppresses the false positives without affecting `.js` file validation or any other language feature. The actual runtime isolation comes from Bascik's IIFE wrapping at build time, not from editor validation.

> **Committing `.vscode/settings.json`.** Checking this file into your repository means every contributor gets the correct editor behaviour without any manual setup step.

If you prefer a per-block fix rather than a project-wide setting, add `// @ts-nocheck` as the first line inside any script block that triggers the warning:

```html
<script>
  // @ts-nocheck
  const count = 0;
  document.getElementById('count-btn').addEventListener('click', () => { … });
</script>
```

#### 5. Inspecting the `dist/` Directory

Both the dev server and `bascik --build` write compiled HTML to `dist/` on disk. This is the most direct way to confirm that Bascik did what you expected.

The `dist/` structure mirrors your `src/pages/` directory with the leading `src/pages/` stripped:

```
src/pages/about.html       →  dist/about.html
src/pages/blog/post.html   →  dist/blog/post.html
```

Open any compiled file and check:

* **Component resolution** — custom tags like `<site-nav>` should be gone, replaced with the component's full HTML. If a hyphenated tag is still present in the output, no matching component file was found.
* **Scoped class names** — elements that came from a component will have classes like `bascik__site-nav__nav` (or a short hash when `obfuscateAttributeNames` is enabled). If classes look unscoped, check that the `.css` file is paired correctly in the same directory as the component's `.html` file.
* **Injected CSS** — each page's `<head>` contains a single `<style>` block assembled from all components used on that page. If styles are missing or duplicated unexpectedly, open the style block and search for the component name.
* **Build script output** — `<script data-bascik-build>` tags are replaced with their stdout. If the output is missing or wrong, check the terminal for a `[bascik] build script error` message and inspect the script directly.
* **Slot and prop content** — verify that slot fallbacks and prop values were injected where expected.

The browser's **View Source** (or DevTools **Sources** panel) shows the same content as `dist/` and is often faster for live debugging during development.

