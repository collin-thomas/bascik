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

Pair a `.css` file alongside the HTML in a same-named directory:

```
src/components/
  site-nav/
    site-nav.html
    site-nav.css
```

All class names, element selectors, and `@keyframes` in the `.css` file are automatically scoped to that component instance.

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
Class attributes use **component-name-only** scope — all instances on the same page share the same scoped class names, which allows CSS deduplication. ID and name attributes include an instance ID to guarantee DOM uniqueness across multiple instances.

```
class  →  bascik__<componentName>__<originalName>
id     →  bascik__<componentName>__<instanceId>__<originalName>
name   →  bascik__<componentName>__<instanceId>__<originalName>
```

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
```html
<!-- my-card.html -->
<div class="card">
  <slot-component>Fallback text</slot-component>
</div>

<!-- usage -->
<my-card><p>Card content</p></my-card>
```
*Note: The `data-bascik-slot` attribute (no value) on any element also marks the default slot, and the element is replaced (not wrapped):* `<section><div data-bascik-slot></div></section>`

#### Named Slots
```html
<!-- layout.html -->
<div>
  <header><div data-bascik-slot="header"></div></header>
  <main><div data-bascik-slot></div></main>
</div>

<!-- usage -->
<layout>
  <p>Main content</p>
  <div data-bascik-slot="header"><h1>Title</h1></div>
</layout>
```

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
  minifyStyles: true,
  obfuscateAttributeNames: true, // hash class/id names to short hex strings
  cacheHttp: false,
  verboseLogging: false,
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
```

### Development Workflow & Server Output
Bascik's CLI is designed to provide clean, minimal, and informative terminal output.

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

