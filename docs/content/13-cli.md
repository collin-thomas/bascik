## CLI

```sh
bascik          # dev: transpile, start HTTP/2 server at https://localhost:8443, watch
bascik --build  # production: transpile to dist/ only
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

