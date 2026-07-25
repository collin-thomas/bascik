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
Generated self-signed certificate for the development server
Server running at https://localhost:8443

transpiled: pages/getting-started.html
transpiled: pages/index.html
transpiled: pages/about.html

✓ 3 pages transpiled in 45ms
```

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

