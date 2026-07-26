# Bascik Developer & Usage Copilot Skill (`SKILL.md`)

This file contains the **complete, centralized documentation and development skill guide** for Bascik. It is designed to provide Copilot and external developers with everything needed to build, compile, maintain, and write components for the Bascik project.

---

## 1. What Bascik Is & Does

> Bascik is a build-time static site generator that turns reusable HTML component files into plain HTML pages. It adds zero JavaScript to the output. You write HTML, CSS, and JavaScript; Bascik scopes and assembles them.

* **Resolves custom HTML tags** (e.g. `<my-nav></my-nav>`) to their component source HTML at build time.
* **Scopes CSS class names, element selectors, `@keyframes`, and CSS custom properties** per component so they never collide.
* **Rewrites DOM selector calls** (`getElementById`, `querySelector`, etc.) in component scripts to match scoped attribute names.
* **Wraps component scripts in IIFEs** so variables do not leak between components.
* **Outputs a `dist/` directory of plain `.html` files** — no framework runtime, no client-side JS added by Bascik itself.

### What Bascik Does NOT Do
* It is not a JavaScript framework. There is no virtual DOM, no reactive state, no client-side routing.
* It does not add any JavaScript to pages. Every script in the output was written by you.
* It does not require Web Components, Shadow DOM, or any browser-specific API.

### Source Vocabulary and Browser Compatibility
* The custom component tags in a Bascik project are the components the developer creates; Bascik does not provide a framework-owned component catalog.
* Build instructions such as `data-bascik-slot`, `data-bascik-prop-*`, and `data-bascik-build` use HTML's standards-valid `data-*` extension mechanism.
* Bascik consumes those instructions at build time. They are not runtime directives that require a client library to interpret them.

---

## 2. Component Format

A component is one `.html` file inside `src/components/`. Its tag name is derived from the file name.

```html
<!-- src/components/site-nav.html -->
<nav class="nav">
  <a href="/">Home</a>
  <a href="/about">About</a>
</nav>
```

Use it in any page or other component:
```html
<site-nav></site-nav>
```
*Self-closing tags are also supported:* `<site-nav />` or `<site-nav class="top" />`

---

## 3. Scoped CSS

> **`<style>` tags inside component HTML files are NOT scoped.** Bascik only reads the paired `.css` file for scoping. A `<style>` tag placed inside a component `.html` file is passed through as-is with no transformation — its rules will leak globally. Always use the paired `.css` file instead.

Pair a `.css` file alongside the HTML in a same-named directory:

```
src/components/
  site-nav/
    site-nav.html
    site-nav.css
```

All class names, element selectors, `#id` selectors, and `@keyframes` in the `.css` file are automatically scoped to that component instance. CSS `#id` selectors are converted to generated class selectors and the class is injected on the matching HTML element.

```css
/* site-nav.css — source */
.nav a {
  color: white;
}
p {
  margin: 0;
}
@keyframes fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

```css
/* compiled output */
.bascik__site-nav__a1b2c3__nav a { color: white; }
.bascik__site-nav__a1b2c3__el__p { margin: 0; }
@keyframes bascik__site-nav__a1b2c3__keyframe__fade { ... }
```

### Scoped CSS Custom Properties
CSS custom properties declared in the file are also scoped:

```css
/* source */
:root {
  --brand: #d3ff8d;
}
.title {
  color: var(--brand);
}

/* compiled */
:root {
  --bascik__site-nav__a1b2c3__brand: #d3ff8d;
}
.bascik__site-nav__a1b2c3__title {
  color: var(--bascik__site-nav__a1b2c3__brand);
}
```

---

## 4. Scoped JavaScript

DOM selectors in component scripts are rewritten to match scoped names:

```html
<!-- source -->
<button id="my-btn">Click</button>
<script>
  document
    .getElementById("my-btn")
    .addEventListener("click", () => alert("hi"));
</script>
```

```html
<!-- compiled -->
<button id="bascik__my-btn__a1b2__my-btn">Click</button>
<script>
  (function () {
    document
      .getElementById("bascik__my-btn__a1b2__my-btn")
      .addEventListener("click", () => alert("hi"));
  })();
</script>
```

### Supported DOM Methods (auto-rewritten)
* `document.getElementById("id")`
* `document.querySelector("#id")` / `document.querySelectorAll("#id")`
* `document.querySelector(".cls")` / `document.querySelectorAll(".cls")` — single OR compound selectors
* `document.querySelector(".foo .bar")` / `querySelector("#id .child")` — compound selectors supported
* `document.getElementsByClassName("cls")`
* `document.getElementsByName("name")`
* `element.closest("#id")` / `element.closest(".cls")` — compound-aware
* `element.matches("#id")` / `element.matches(".cls")` — works for event delegation too
* `element.classList.add/remove/toggle/contains("cls")`
* `element.setAttribute("class", "cls")` / `setAttribute("id", "id-value")` — string literal values
* `element.className = "cls"` or `"cls1 cls2"` or `+= " cls"` — setter forms

### Scoping Model
`id` and `name` attributes are scoped **per-instance** — each use of a component generates a different `instanceId`, guaranteeing unique DOM IDs even when the same component appears multiple times on a page. `class` attributes are scoped to the component name only (no instanceId), so all instances share the same class names and CSS deduplication emits a single `<style>` block.

```
class  →  bascik__<componentName>__<originalName>
id     →  bascik__<componentName>__<instanceId>__<originalName>
name   →  bascik__<componentName>__<instanceId>__<originalName>
```

### Multiple Instances
Using a component more than once works automatically — each use gets a different `instanceId`, so IDs never collide and each instance's scripts reference only its own elements.

### Class Selectors and Multiple Instances (PITFALL)
Because class names are scoped to the component **name** (not per-instance), `querySelector('.my-class')` and `querySelectorAll('.my-class')` **always return the first matching element in the document**, even after Bascik rewrites the class name. When the same component is used more than once on a page, every instance's script will target the first instance's elements — the other instances' buttons/inputs/etc. will appear non-functional.

**Rule:** In component scripts, always use `getElementById` (or `getElementsByName`) to locate specific elements — both are per-instance scoped and always resolve to the correct element. Never use `querySelector`/`querySelectorAll` with a class selector to find an element you need to control per-instance.

```html
<!-- ❌ Broken for multiple instances -->
<button class="my-btn">Click</button>
<script>
  document.querySelector('.my-btn').addEventListener('click', () => { … });
</script>

<!-- ✅ Correct — id is per-instance -->
<button id="my-btn" class="my-btn">Click</button>
<script>
  document.getElementById('my-btn').addEventListener('click', () => { … });
</script>
```

**Escape hatch:** Set `deduplicateCss: false` in `bascik.config.js` to switch to per-instance class scoping. Class selectors will then behave like ID selectors — but each instance emits its own `<style>` block. For most components, using an `id` to anchor the script is simpler.

---

## 5. Dynamic Runtime Class Scoping (CRITICAL BUG & PATTERN)

### The Problem
If you have a class or ID name that is **only toggled or added dynamically at runtime** by JavaScript (for example, with `.classList.toggle("is-open")` or `.classList.add("is-active")`) but **does not exist on any HTML tag inside the template at compile time**, Bascik's HTML compiler will not discover or register it.

This causes a compilation mismatch:
* The **CSS parser** *will* obfuscate the class name inside your stylesheet.
* The **JS parser** *will not* obfuscate the class name inside your scripts because it was never registered in the HTML pass.
* At runtime, your script will toggle `"is-open"`, but the CSS will be listening for the obfuscated `.bf5a887ac3134` class, causing interactive elements like menus or modals to fail silently.

### The Solution: Scoping Helpers
Always declare any dynamic classes or IDs inside a hidden scoping helper element inside your HTML template. This forces Bascik's HTML parser to register and synchronize the names during compilation:

```html
<!-- Scoping helper for dynamic runtime classes -->
<div class="is-open is-active" style="display: none;"></div>
```

---

## 6. Slots & Props

### Slots (Default & Named)

#### Default Slot

Add `data-bascik-slot` (no value) to any element in the component template. The element is replaced by the slot content at the usage site. Use the element's inner content as fallback when no slot content is provided.

```html
<!-- my-card.html -->
<div class="card">
  <div data-bascik-slot><p>No content provided.</p></div>
</div>

<!-- usage -->
<my-card>
  <h2>Card Title</h2>
  <p>Card body text.</p>
</my-card>

<!-- output -->
<div class="card">
  <h2>Card Title</h2>
  <p>Card body text.</p>
</div>
```

#### Named Slots

Use `data-bascik-slot="name"` in the template to define named zones. At the usage site, wrap content with the same attribute.

```html
<!-- page-layout.html -->
<div class="layout">
  <header><div data-bascik-slot="header"></div></header>
  <main><div data-bascik-slot></div></main>
  <aside><div data-bascik-slot="sidebar"></div></aside>
</div>

<!-- usage -->
<page-layout>
  <p>Main body content.</p>
  <div data-bascik-slot="header"><h1>Page Title</h1></div>
  <div data-bascik-slot="sidebar"><nav>Sidebar nav</nav></div>
</page-layout>
```

### Slot Whitespace
Leading and trailing whitespace is trimmed from all slot content at build time. Whitespace *within* slot content is preserved exactly as written.

### Props
Inject text values into a component at usage time.

```html
<!-- alert-box.html -->
<div class="alert">
  <strong data-bascik-prop-title></strong>
  <p data-bascik-prop-message></p>
</div>

<!-- usage -->
<alert-box
  data-bascik-prop-title="Success"
  data-bascik-prop-message="Your changes were saved."
></alert-box>
```
*Props accept text values only. For rich HTML content, use slots.*

---

## 7. Attribute Inheritance & Tags

### Attribute Inheritance
Non-`data-bascik-*` attributes on a usage tag are merged onto the component's root element. `id` is excluded.
```html
<site-nav class="sticky" aria-label="main navigation"></site-nav>
<!-- class "sticky" and aria-label are merged onto <nav> in site-nav.html -->
```

### Self-Closing Tags
```html
<my-nav /> <my-nav class="top" />
```

### Head Components
Components work inside `<head>` to organize metadata:
```html
<!-- src/components/site-meta.html -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="description" content="My site" />

<!-- usage -->
<head>
  <title>Home</title>
  <site-meta></site-meta>
</head>
```

---

## 8. Build-time Scripts

`<script data-bascik-build>` blocks are executed at transpile time as Node.js ESM modules. The script's stdout is injected in place of the tag. Runs in both dev and build modes.

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import { marked } from 'marked';
  const md = await readFile('./content/intro.md', 'utf8');
  console.log(marked(md));
</script>
```

* Top-level `import` and top-level `await` are supported.
* CWD is the project root. Relative paths resolve from there.
* Use `console.log()` or `process.stdout.write()` to output HTML.
* Build scripts run before component resolution, so their output can contain component tags.
* On error, the script tag is replaced with an empty string and a warning is logged.

### Rendering and Styling Markdown

Install a Markdown parser such as `marked`, read the source in a build script, and write the resulting HTML to stdout:

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import { marked } from 'marked';

  const md = await readFile('./content/article.md', 'utf8');
  console.log(marked(md));
</script>
```

The parser emits ordinary HTML, so it can be styled by a global stylesheet or wrapped in a Bascik component. For reusable scoped styles, have the script emit `<markdown-content>${marked(md)}</markdown-content>` and give that component a default slot.

Use wrapper descendant selectors for generated slot content:

```css
.markdown-content h2 { margin-block: 2.5rem 0.75rem; }
.markdown-content blockquote { border-left: 4px solid currentColor; }
```

Do not rely on a bare `h2 {}` component rule for Markdown passed through a slot. Bare element rules are transformed before slot content is inserted; a scoped wrapper selector continues to match the generated descendants.

### data-bascik-dev

Tag a browser script with `data-bascik-dev` to mark it as dev-only. In development the attribute is stripped and the script runs normally in the browser. In production builds (`bascik --build`) the entire script tag is removed.

```html
<script data-bascik-dev>
  console.log('dev only — stripped from production build');
</script>
```

Useful for debug logging, development overlays, or any browser script that should never ship to production.

> **dev vs. build:** `data-bascik-build` executes at transpile time and injects HTML into the page. `data-bascik-dev` runs in the browser, but only in dev mode.

---

## 9. Configuration (`bascik.config.js`)

```js
export const bascikConfig = {
  directory: {
    pages: "src/pages", // default
    components: "src/components", // default
  },
  scopeScriptBlocks: true,
  scopeAttribute: {
    class: true,
    id: true,
    name: true,
  },
  deduplicateCss: true,
  skipTranspilingElementContents: ['code'], // don't scope inside these elements
  minifyStyles: true,
  obfuscateAttributeNames: true, // hash class/id names to short hex strings
  cacheHttp: false,
  verboseLogging: false,
  siteUrl: 'https://example.com',
  generate: {
    sitemap: true, // write dist/sitemap.xml
    robots: true,  // write dist/robots.txt
  },
  triggerTranspile: [], // re-transpile all pages when these paths change (dev only)
};

// Applied only during `bascik --build`, merged over bascikConfig
export const buildOverrideConfig = {
  obfuscateAttributeNames: true,
  minifyStyles: true,
};
```

---

## 10. Folder Structure, 404, and 500 pages

```
src/
  pages/       ← one .html file per route (plus CSS, images, etc.)
  components/  ← component .html (+ optional .css) files
```

### Custom 404 & 500 Pages
* **404 Page (`src/pages/404.html`):** If you create a `404.html` file in your pages directory, Bascik's built-in development server will automatically serve it as a fallback for any non-existent routes with a `404` status code. When you build for production (`bascik --build`), this is compiled to `dist/404.html` which is recognized by standard static hosts (GitHub Pages, Vercel, Netlify).
* **500 Page Support:** If the server encounters runtime compilation errors, it responds with a proper `500` error block to prevent server crashes.

---

## 11. CLI & Development Workflow

```sh
bascik          # dev: transpile, start HTTP/2 server at https://localhost:8443, watch
bascik --build  # production: transpile to dist/ only
bascik --check  # static analysis: validate pages and components without building
```

### Development Workflow & Server Output
Bascik's CLI is designed to provide clean, minimal, and informative terminal output.

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
Run `bascik --check` from your project root to validate pages and component files without starting the dev server or writing any output:

```sh
bascik --check
```

Bascik scans every `.html` file in your pages and components directories and reports:
* **Errors** — hyphenated tags with no matching component file (the tag renders as-is in the HTML output):
  ```terminal
  [bascik check] Unknown component in "pages/about.html": <my-missing> — no matching component file found
  ```
* **Warnings** — component files that are never referenced:
  ```terminal
  [bascik check] Unused component: <old-widget> — defined but never referenced
  ```
* **Success**:
  ```terminal
  [bascik check] ✓ 8 pages and 12 components checked — no errors
  ```

Exits with code `1` on errors — suitable for CI:
```sh
bascik --check && bascik --build
```

**What `bascik --check` does not cover:** it validates component references only — not CSS or JavaScript syntax. A CSS syntax error can cause bascik's scoping transforms to produce garbled output without any warning. Use external tools alongside `--check`:

| Tool | What it catches |
|---|---|
| VS Code built-in CSS | CSS syntax errors (squiggly lines, no install needed) |
| [Stylelint](https://stylelint.io) | CSS syntax, invalid properties, conventions |
| [HTMLHint](https://htmlhint.com) | HTML structure errors in `.html` files |
| [ESLint](https://eslint.org) | JS syntax and logic errors in `<script>` blocks |

Recommended CI pipeline with CSS validation:
```sh
npx stylelint "src/**/*.css" && bascik --check && bascik --build
```

#### Editor Configuration

Editors validate all `<script>` blocks in an HTML file as sharing one scope, causing false "variable already declared" errors. Bascik wraps each block in an IIFE at build time, so the errors are false positives.

**VS Code fix** — add `.vscode/settings.json`:
```json
{ "html.validate.scripts": false }
```

Commit this file so all contributors get the correct behaviour automatically. Alternatively, add `// @ts-nocheck` as the first line inside any individual script block that triggers the warning.

#### 5. Inspecting `dist/` Output

Both the dev server and `bascik --build` write compiled HTML to `dist/` on disk — this is the ground truth of what Bascik produced. The `dist/` structure mirrors `src/pages/` with the leading directory stripped:

```
src/pages/about.html       →  dist/about.html
src/pages/blog/post.html   →  dist/blog/post.html
```

What to check in compiled output:
* **Component resolution:** every custom tag (e.g. `<site-nav>`) should be replaced with expanded HTML. A hyphenated tag still present in `dist/` means no component file matched.
* **Scoped class names:** attributes like `class="bascik__site-nav__nav"` (or a short hash with `obfuscateAttributeNames`) confirm CSS scoping ran correctly.
* **Injected `<style>` block:** the `<head>` should contain one combined `<style>` with CSS from all components used on that page.
* **Build script output:** `<script data-bascik-build>` is replaced with stdout; if missing, check the terminal for a `[bascik] build script error` line.
* **Slot and prop values:** verify fallback and injected text appear in the right place.

The browser's **View Source** (or DevTools **Sources** panel) is equivalent to reading `dist/` and is often faster during development.

---

## 12. JavaScript Libraries & Progressive Enhancement

Bascik adds zero JavaScript to output pages by default, but places no restrictions on including external libraries.

### How to Include
Add a CDN `<script src>` tag to the page `<head>` or a shared head component. Bascik passes external script tags through completely unchanged.

```html
<head>
  <script src="https://unpkg.com/petite-vue" defer init></script>
</head>
```

### petite-vue
petite-vue (~5 KB) is a Vue-compatible progressive enhancement library. Declare `v-scope` on any element to give it isolated reactive state:

```html
<!-- src/components/my-counter.html -->
<div v-cloak v-scope="{ count: 0 }">
  {{ count }}
  <button @click="count++">+</button>
</div>
```

Load it once in the page `<head>` with `defer init` to auto-mount all `v-scope` elements:
```html
<script src="https://unpkg.com/petite-vue" defer init></script>
```

### Alpine.js
Alpine.js uses `x-data` for state and `@click` / `x-show` for events and visibility:

```html
<div x-data="{ open: false }">
  <button @click="open = !open">Toggle</button>
  <p x-show="open">Hidden content.</p>
</div>
<script src="https://unpkg.com/alpinejs" defer></script>
```

### Tailwind CSS
Tailwind utility classes are global by design. Bascik's class scoping would rename `class="flex gap-4"` to `class="bascik__comp__flex bascik__comp__gap-4"`, breaking Tailwind's CSS.

**Required config** — disable class scoping in `bascik.config.js`:
```js
export const bascikConfig = {
  scopeAttribute: {
    class: false, // let Tailwind utility classes pass through unchanged
    id: true,
    name: true,
  },
};
```

Include Tailwind via CDN (development) or Tailwind CLI (production):
```html
<script src="https://cdn.tailwindcss.com"></script>
```

With `class: false`, utility classes work normally inside any component:
```html
<!-- src/components/feature-card.html -->
<div class="rounded-xl border border-gray-200 p-6 shadow-sm">
  <h3 class="mb-2 text-lg font-semibold" data-bascik-prop-title></h3>
  <p class="text-sm text-gray-600" data-bascik-prop-body></p>
</div>
```

Trade-off: with `class: false`, Bascik no longer isolates component class names. IDs and names remain scoped independently.

### HTMX, Stimulus, and Others
* **HTMX** — Uses `hx-get`, `hx-post` attributes for server-driven partial updates.
* **Stimulus** — Uses `data-controller` for attaching behavior to DOM structures.
* **Chart.js, D3, Leaflet** — Mounts to elements via `getElementById`; Bascik rewrites the ID and matching selectors at build-time so they stay in sync.

---

## 13. Key Constraints & Rules for AI Code Generation (MUST FOLLOW)

When generating code, pages, or components for a Bascik project, the following conventions are strictly enforced:

1. **Hyphenated Custom Tags:** Component tag names must be hyphenated (e.g. `my-nav`, `site-header`). Single-word tags are not valid custom element names.
2. **Scoping Rules:** CSS scoping only applies to paired `.css` files and inline `<style>` tags inside component HTML.
3. **Selector Rewrites:** CSS `#id {}` hash selectors are converted to component-scoped class selectors; the class is automatically injected onto the matching element. The `[id]` attribute-selector form is stripped.
4. **Script Selectors:** Use `id` and `class` selectors in JS that exactly match the attributes in the component HTML — Bascik rewrites them at build time.
5. **DOM Traversal:** For compound DOM queries, query by a single scoped `id` first, then traverse from the returned element.
6. **Dynamic Toggles:** Use `data-` attributes for runtime state that changes via JavaScript (e.g. `data-state="open"`). Scoped class names are assigned at build time and cannot be reliably looked up by JS string manipulation *unless* you utilize a scoping helper (Section 5).
7. **Text Props:** Props accept text only. For rich HTML content, use slots.
8. **Script Modules:** `<script type="module">` scripts are not wrapped in an IIFE, but their selectors are still rewritten.

