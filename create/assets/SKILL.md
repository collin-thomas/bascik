---
name: bascik
description: Comprehensive guide for building with Bascik, a file-based web component framework. Use when creating components, writing scoped CSS or JavaScript, configuring props or slots, using the CLI, setting up the build, or debugging Bascik-specific behavior.
---

# Bascik Developer & Usage Copilot Skill (`SKILL.md`)

This file contains the **complete, centralized documentation and development skill guide** for Bascik. It is designed to provide Copilot and external developers with everything needed to build, compile, maintain, and write components for the Bascik project.

---

## 1. What Bascik Is & Does

> Bascik is a build tool for HTML components. It scopes and assembles reusable HTML component files into plain HTML pages at build time. It adds zero JavaScript to the output. You write HTML, CSS, and JavaScript; Bascik scopes and assembles them.

* **Resolves custom HTML tags** (e.g. `<my-nav></my-nav>`) to their component source HTML at build time.
* **Scopes CSS class names, element selectors, `@keyframes`, and CSS custom properties** per component so they never collide.
* **Rewrites DOM selector calls** (`getElementById`, `querySelector`, etc.) in component scripts to match scoped attribute names.
* **Wraps component scripts in IIFEs** so variables do not leak between components.
* **Outputs a `dist/` directory of plain `.html` files** with zero runtime dependencies and no client-side JS added by Bascik itself.

### What Bascik Does NOT Do
* It is not a JavaScript framework. There is no virtual DOM, no reactive state, no client-side routing.
* It does not add any JavaScript to pages. Every script in the output was written by you.
* It does not require Web Components, Shadow DOM, or any browser-specific API.

### End-to-End Example: Input → Output

One component file, its usage, and the scoped build output:

```html
<!-- src/components/my-card.html -->
<style>
  .card {
    padding: 26px 28px;
    border: 1px solid #3a3d40;
    border-radius: 10px;
    &.active { border-color: #d3ff8d; }
  }
</style>
<div class="card" id="card">
  <div data-bascik-slot></div>
</div>
<script>
  const card = document.getElementById('card');
  card.addEventListener('click', () => {
    card.classList.toggle('active');
  });
</script>
```

```html
<!-- src/pages/index.html -->
<my-card>
  <h3>My Card</h3>
  <p>Any HTML goes inside as slot content.</p>
</my-card>
```

```html
<!-- dist/index.html - classes and selectors scoped, script wrapped in IIFE -->
<style>
  .bascik__my-card__card {
    padding: 26px 28px;
    border: 1px solid #3a3d40;
    border-radius: 10px;
    &.bascik__my-card__active { border-color: #d3ff8d; }
  }
</style>
<div class="bascik__my-card__card" id="bascik__my-card__a1b__card">
  <h3>My Card</h3>
  <p>Any HTML goes inside as slot content.</p>
</div>
<script>
  (function () {
    const card = document.getElementById('bascik__my-card__a1b__card');
    card.addEventListener('click', () => {
      card.classList.toggle('bascik__my-card__active');
    });
  })();
</script>
```

Because IDs are scoped per instance, the same component can appear multiple times on one page and each instance's JS stays fully isolated. Plain `getElementById` / `querySelector` calls just work.


### How Bascik Positions Against Other Tools
* **Next.js** is a full React meta-framework aimed at applications with complex client-side state, authentication, and API routes. Many teams reach for it on content sites and landing pages, but every page ships 80–100+ KB of React runtime regardless of whether any reactivity is used. Its conventions also gradually pull projects toward client-side patterns. For a lot of what people build, that is simply more framework than the project needs. Bascik is built for exactly that kind of work: plain HTML, CSS, and JS authoring with component reuse, a dist folder you can open and verify file by file, and no runtime overhead affecting Core Web Vitals.
* **Closest surface resemblance to Svelte:** Both use single-file components with scoped styles. The difference is that Svelte compiles to a JavaScript runtime for reactive DOM management; Bascik compiles to plain HTML with no runtime added.
* **Complements HTMX and Alpine.js:** Bascik resolves components at build time; HTMX/Alpine add behavior at runtime. They compose cleanly, with each tool doing what it is best at.
* **Different scope than Hugo / Eleventy / Jekyll:** those tools focus on content pipelines (Markdown collections, taxonomies, front matter). Bascik focuses on HTML page composition and component reuse without a template language.
* Most of what people build, content sites, marketing pages, docs portals, blogs, landing pages, does not require a framework runtime in the browser. Bascik fills the gap: component reuse and predictable build output, without a runtime or new programming model to adopt.

### Source Vocabulary and Browser Compatibility
* The custom component tags in a Bascik project are the components the developer creates; Bascik does not provide a framework-owned component catalog.
* Build instructions such as `data-bascik-slot`, `data-bascik-prop-*`, and `data-bascik-build` use HTML's standards-valid `data-*` extension mechanism.
* Bascik consumes those instructions at build time. They are not runtime directives that require a client library to interpret them.

### Repository Layout and the Create App

The repo is split into four top-level folders:

```text
bascik/
  pkg/          ← the @bascik/bascik npm package
  create/       ← the standalone generator used by `npm create bascik@latest`
  docs/         ← the docs site and internal developer guide
  extensions/   ← editor tooling, including the VS Code extension for component navigation and scoping checks
```

The `create/` folder is intentionally separate from `pkg/`. Contributor work in this monorepo uses Yarn 4 with `yarn.lock`, while generated projects intentionally use npm and receive their own `package-lock.json`. That split keeps contributor workflows Yarn-based while preserving the standard npm onboarding flow for generated apps.

The editor package in `extensions/vscode-bascik/` is intentionally separate from `pkg/`. It provides command-click component resolution and warnings for patterns that are unsupported or risky under Bascik's scoping model. The rules are generated from the compatibility matrix in `docs/content/compatibility.md` via `docs/scripts/generate-compatibility-rules.ts`, so the editor and the published capability table stay in sync automatically instead of drifting apart.

The generator in `create/src/index.ts` validates input, then calls `create/src/scaffold.ts` to write the project files. The generated app is not coupled to the monorepo layout. It just uses the published `@bascik/bascik` package and then runs as a normal Bascik site.

For local contributor testing of the generator itself, rebuild from `create/`, link it with `npm link`, and invoke it via `npx create-bascik ...`; that remains the working flow for exercising the local scaffold end-to-end. `npm link` runs the `prepare` script, which copies the latest SKILL.md from `docs/` and rebuilds `dist/` automatically, so no separate build step is needed after a fresh checkout.

---

## 2. Component Format

A component is one `.html` file inside `src/components/`. Its tag name is derived from the file name.

**HTML-only component:**
```html
<!-- src/components/page-footer.html -->
<footer>
  <p>© 2025 My Site. All rights reserved.</p>
</footer>
```

**HTML with inline CSS:**
```html
<!-- src/components/promo-banner.html -->
<style>
  .banner { padding: 1rem 1.5rem; background: #e8f4fd; border-left: 4px solid #3b82f6; }
</style>
<aside class="banner">…</aside>
```

**HTML with inline JavaScript** (use `id` + `getElementById` for per-instance targeting):
```html
<!-- src/components/scroll-top.html -->
<button id="btn" type="button">Back to top</button>
<script>
  document.getElementById('btn').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
</script>
```

**All three in one file** (HTML + `<style>` + `<script>`):
```html
<!-- src/components/alert-box.html -->
<style>
  .alert { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; border: 1px solid #f59e0b; border-radius: 6px; background: #fffbeb; }
  .alert-close { margin-left: auto; background: none; border: none; cursor: pointer; }
</style>
<div class="alert" id="alert">
  <span>Maintenance on Sunday, 2am–4am UTC.</span>
  <button id="close" class="alert-close" aria-label="Dismiss">×</button>
</div>
<script>
  document.getElementById('close').addEventListener('click', () => {
    document.getElementById('alert').hidden = true;
  });
</script>
```

Use it in any page or other component:
```html
<alert-box></alert-box>
```
*Self-closing tags are also supported:* `<site-nav />` or `<site-nav class="top" />`

**Separate CSS file** — pair a `.css` file with the same base name:
```
src/components/
  alert-box.html
  alert-box.css   ← scoped to alert-box
```

**Subfolder layout** (same tag name regardless of folder):
```
src/components/
  alert-box/
    alert-box.html
    alert-box.css
```

### Multiple Root Elements
Unlike other frameworks that require a single wrapper element or fragment, Bascik component templates support multiple top-level HTML elements in a single `.html` file. All root elements are inserted in order. If non-`data-bascik-*` attributes are passed on a usage tag, Bascik merges them onto the first root HTML element.

**No restart needed.** The dev server watches the components directory. Drop a new `.html` (or paired `.css`) file in and all pages that use that tag are automatically re-transpiled and reloaded with no server restart required.

---

## 3. Scoped CSS

Scoped CSS can live in a paired `.css` file or one or more inline `<style>` tags inside component HTML. Both go through the same scoping pipeline.

At build time, Bascik extracts all inline `<style>` blocks, combines them with any companion `.css` file, scopes them, and injects them into the document `<head>`. Using multiple `<style>` tags (or mixing them with a companion `.css` file) is supported but not recommended for readability and maintainability. Choose a single stylesheet pattern per component.

Pair a `.css` file alongside the HTML in a same-named directory:

```
src/components/
  site-nav/
    site-nav.html
    site-nav.css
```

All class names, element selectors, `#id` selectors, `@keyframes`, `@layer`, `@container`, `:is()/.class`, `:where()/.class`, `:has()/.class`, child/sibling combinator selectors, and CSS custom properties in component CSS are automatically scoped to that component. SVG elements with `class` attributes inside component HTML are also scoped. CSS `#id` selectors are converted to generated class selectors and the class is injected on the matching HTML element.

`html`, `body`, and `head` are **never** converted to scoped classes. Cross-boundary selectors like `html[data-theme="light"] .foo {}` compile correctly: the root element name is preserved verbatim and only `.foo` is scoped, producing `html[data-theme="light"] .bascik__comp__foo {}`. This means theme-switching, dark/light mode, and other document-root state selectors in component CSS work as expected.

These rewrites compose normally in one component: bare element selectors receive generated classes, locally declared custom properties and their `var()` references are renamed together, and keyframe declarations stay synchronized with `animation` references.

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
.bascik__site-nav__nav a { color: white; }
.bascik__site-nav__el__p { margin: 0; }
@keyframes bascik__site-nav__keyframe__fade { ... }
```

### Scoped CSS Custom Properties
CSS custom properties declared in the file are also scoped. `var(--prop, fallback)` with fallback values is fully supported, the property name is scoped and the fallback preserved:

```css
/* source */
:root {
  --brand: #d3ff8d;
}
.title {
  color: var(--brand);
  border-color: var(--brand, rgb(150, 150, 150)); /* fallback preserved */
}

/* compiled */
:root {
  --bascik__site-nav__brand: #d3ff8d;
}
.bascik__site-nav__title {
  color: var(--bascik__site-nav__brand);
  border-color: var(--bascik__site-nav__brand, rgb(150, 150, 150));
}
```

#### Using global design tokens in a component
Define your design tokens once in a global stylesheet, then consume them inside any component. Because the component never declares those properties locally, Bascik leaves the `var()` references as-is and they resolve from the global stylesheet at render time.

```css
/* src/styles.css — design tokens, linked in every page <head> */
:root {
  --brand: #d3ff8d;
  --card-bg: #1e2022;
  --text-muted: #8d929e;
}
```

```html
<!-- src/components/brand-card.html -->
<style>
  .card {
    padding: 24px 28px;
    background: var(--card-bg); /* global — Bascik leaves untouched */
    border-top: 3px solid var(--brand);
    border-radius: 10px;
  }
  .card-label {
    color: var(--text-muted);
  }
</style>
<div class="card">
  <p class="card-label" data-bascik-prop-label></p>
  <div data-bascik-slot></div>
</div>
```

```css
/* dist/ output — class names scoped, var() refs preserved */
.bascik__brand-card__card {
  padding: 24px 28px;
  background: var(--card-bg);
  border-top: 3px solid var(--brand);
  border-radius: 10px;
}
.bascik__brand-card__card-label {
  color: var(--text-muted);
}
```

### CSS Scoping Compatibility Notes
* `@property`: `@property --name { }` declaration names are scoped along with any matching `--name:` declarations and `var(--name)` references in the same component
* `@starting-style`: class names and element selectors inside `@starting-style` blocks are scoped by the same passes that handle other at-rules; both standalone `@starting-style { .foo { } }` and nested `.foo { @starting-style { } }` forms work
* `@counter-style`: `@counter-style name { }` declaration names are scoped; references in `list-style`, `list-style-type`, `counter(counter, name)`, and `counters(counter, sep, name)` in the same CSS file are updated to match
* `view-transition-name`: ✓ values are scoped per component (`bascik__<comp>__vtn__<name>`); matching `::view-transition-old/new/group/image-pair()` pseudo-element references in the same file are updated; `none` and `auto` are not scoped
* `anchor-name` / `@position-try`: `anchor-name: --name` declarations are scoped per component; matching `position-anchor: --name` references and `@position-try --name { }` at-rules in the same CSS file are updated to match; only anchors declared in the component's own CSS are scoped
* `@scope` (native): class names in `@scope (.foo)` argument and optional `to (.clause)` are scoped normally, and class names inside the `@scope` block are scoped
* `:nth-child(An+B of .selector)`: class names in the `of <selector>` argument are scoped (same global `(?<=\.)` pass as `:is()`, `:where()`, `:has()`); works for `:nth-child` and `:nth-last-child`
* `@font-face`: passed through untouched; declare in a shared stylesheet to avoid duplicate injections
* `@import`: not followed; include CSS directly in the component file instead
* Standalone attribute selectors (e.g. `[data-state]`): not scoped and can leak globally; anchor with a scoped class: `.card[data-state]`
* `[id]` selectors: `[id]` and `[id="..."]` attribute selectors in CSS are stripped at compile time because they cannot be scoped without DOM wrapping
* Compound element selectors: `.class element {}` and `.class > element {}` are scoped (element converted to class and injected on matching HTML elements); patterns with two bare elements (`div p {}`) still require a class anchor on the left
* Element names inside `:is()`, `:where()`, and `:has()` are not converted; use class selectors inside those pseudo-classes instead

---

## 4. Scoped JavaScript

**Key rule:** Use `id` attributes to identify elements you need to control per-instance, and `getElementById` to find them. Bascik rewrites selector strings at build time, you write your component as if it's the only one on the page.

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
* `document.querySelector(".cls")` / `document.querySelectorAll(".cls")`: single OR compound selectors
* `document.querySelector(".foo .bar")` / `querySelector("#id .child")`: compound selectors supported
* `document.getElementsByClassName("cls")`
* `document.getElementsByName("name")`
* `element.closest("#id")` / `element.closest(".cls")`: compound-aware
* `element.matches("#id")` / `element.matches(".cls")`: works for event delegation too
* `element.classList.add/remove/toggle/contains("cls")`: all single and multi-argument forms
* `element.classList.replace("old", "new")`: both arguments rewritten
* `element.setAttribute("class", "cls")` / `setAttribute("id", "id-value")` / `setAttribute("name", "value")`: string literal values
* `element.className = "cls"` or `"cls1 cls2"` or `+= " cls"`: setter forms; space-separated multi-class strings fully rewritten
* `innerHTML` / `insertAdjacentHTML` string literals, known class names inside the HTML string are rewritten
* `removeAttribute`, `hasAttribute`, `toggleAttribute`: take attribute names (not values), no rewriting needed
* **JS-only class discovery:** class names referenced in `classList.*`, `.className` in selector strings, `el.className = "..."`, and `setAttribute("class", "...")` are automatically discovered and added to the class scope map before JS rewriting.

### Not Rewritten (known limitations)
* `el.id = "value"`: property setter not rewritten; use `getElementById` then work from the reference
* `el.style.setProperty("--my-var", value)`: runtime CSS custom property names are not rewritten; the scoped var name (e.g. `--bascik__comp__my-var`) is different from the source name
* Template literals: `` el.className = `box ${state}` ``, not rewritten; use `classList.add/remove` instead
* Template-literal replacement arguments in `classList.replace(oldName, \`${dynamic}\`)` are not rewritten safely; prefer `classList.add/remove/toggle` with static class names
* `querySelector("[name='username']")`: attribute-selector form for `name`; use `getElementsByName` instead
* `innerHTML` / `insertAdjacentHTML` string literals: scanning only recognizes class names that appear in the HTML template.

### Scoping Model
`id` and `name` attributes are scoped **per-instance:** each use of a component generates a different `instanceId`, guaranteeing unique DOM IDs even when the same component appears multiple times on a page. `class` attributes are scoped to the component name only (no instanceId), so all instances share the same class names and CSS deduplication emits a single `<style>` block.

Form inputs using `<input name="username">` receive per-instance scoped names (e.g. `bascik__comp__a1b2c3__username`), so `new FormData(form)` keys reflect the scoped name.

Literal component tags inside `<script>`, `<style>`, `<textarea>`, or HTML comments (`<!-- <my-card> -->`) are treated as text and never resolved into components.

```
class  →  bascik__<componentName>__<originalName>
id     →  bascik__<componentName>__<instanceId>__<originalName>
name   →  bascik__<componentName>__<instanceId>__<originalName>
```

### Multiple Script Blocks
Component templates can contain multiple `<script>` tags. Bascik processes each script tag according to its attributes:
* **Client scripts:** Standard JavaScript blocks are each wrapped in an isolated IIFE `(function() { ... })();` when `scopeScriptBlocks` is enabled. If you include multiple client `<script>` tags in a single component, each runs in its own IIFE so local variables do not collide.
* **Build scripts (`<script data-bascik-build>`):** Executed during build or dev time in Node.js to generate dynamic markup.
* **Server scripts (`<script data-bascik-server>`):** Executed on the server at request time in Node.js.
* **Data scripts (e.g. `type="application/ld+json"`):** Left untouched without IIFE wrapping or JavaScript minification.

Recommended Pattern: Keeping separate, unrelated concerns in dedicated client `<script>` tags (like form validation and UI animation) is recommended for code readability and maintainability.

### Multiple Instances
Using a component more than once works automatically, each use gets a different `instanceId`, so IDs never collide and each instance's scripts reference only its own elements.

### Class Selectors and Multiple Instances (PITFALL)
Because class names are scoped to the component **name** (not per-instance), `querySelector('.my-class')` and `querySelectorAll('.my-class')` **always return the first matching element in the document**, even after Bascik rewrites the class name. When the same component is used more than once on a page, every instance's script will target the first instance's elements, the other instances' buttons/inputs/etc. will appear non-functional.

**Rule:** In component scripts, always use `getElementById` (or `getElementsByName`) to locate specific elements, both are per-instance scoped and always resolve to the correct element. Never use `querySelector`/`querySelectorAll` with a class selector to find an element you need to control per-instance.

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

**Escape hatch:** Set `deduplicateCss: false` in `bascik.config.ts` to switch to per-instance class scoping. By default, all instances of the same component share identical scoped class names so Bascik emits one shared `<style>` block per component. With `deduplicateCss: false`, class selectors become unique per instance (like IDs), but Bascik emits a separate `<style>` block for each component instance.

### `deduplicateCss` Trade-Off Comparison

Setting `deduplicateCss` in `bascik.config.ts` controls whether class names are scoped per component type or per component instance.

| Feature or Aspect | `deduplicateCss: true` (Default) | `deduplicateCss: false` |
|---|---|---|
| **Class Scoping Scheme** | `bascik__card__wrapper` (shared per component) | `bascik__card__a1b2c3d4__wrapper` (unique per instance) |
| **CSS Payload** | Single `<style>` block per component type, zero CSS duplication | Multiplied `<style>` blocks (one block per component instance) |
| **`querySelector('.cls')` Behavior** | Targets the first instance on the page | Targets the matching element inside that specific instance |
| **Instance Isolation Model** | Use `id` and `getElementById()` for per-instance script isolation | Class selectors inherently isolate per instance |
| **Best For** | Virtually all production sites and design systems | Migrating legacy or third-party code that relies on class queries |

#### Side-by-Side Code Example

Given two instances of `<my-card>` on the same page:

```html
<!-- Input Page HTML -->
<my-card></my-card>
<my-card></my-card>
```

**Output with `deduplicateCss: true` (Default, Shared Class Scope):**

```html
<!-- HTML Output: Shared classes, unique IDs -->
<div class="bascik__my-card__wrapper" id="bascik__my-card__a1b2c3d4__root">...</div>
<div class="bascik__my-card__wrapper" id="bascik__my-card__e5f6g7h8__root">...</div>

<!-- CSS Output: Emitted once in <head> -->
<style>
  .bascik__my-card__wrapper { padding: 1rem; }
</style>
```

**Output with `deduplicateCss: false` (Per-Instance Class Scope):**

```html
<!-- HTML Output: Unique classes per instance -->
<div class="bascik__my-card__a1b2c3d4__wrapper" id="bascik__my-card__a1b2c3d4__root">...</div>
<div class="bascik__my-card__e5f6g7h8__wrapper" id="bascik__my-card__e5f6g7h8__root">...</div>

<!-- CSS Output: Emitted for every instance -->
<style>
  .bascik__my-card__a1b2c3d4__wrapper { padding: 1rem; }
  .bascik__my-card__e5f6g7h8__wrapper { padding: 1rem; }
</style>
```

Using the `id`-based pattern with `getElementById()` is recommended because it gives you per-instance JS isolation while keeping `deduplicateCss: true` for minimal CSS payload.

### TypeScript in Component Scripts

Bascik ships plain JavaScript to the browser, so TypeScript in component `<script>` blocks must be stripped before output is served. Wire Node 22.18+'s built-in `stripTypeScriptTypes` into the `minifyScripts` hook:

```ts
// bascik.config.ts
import { stripTypeScriptTypes } from 'node:module';
import { defineConfig } from '@bascik/bascik/config';

export const build = defineConfig({
  minifyScripts: (js) => stripTypeScriptTypes(js),
});
```

Component scripts can then use TypeScript annotations freely. Bascik's scoping pipeline runs first (IIFE wrapping, selector rewriting), then `minifyScripts` strips the types. **Erasable syntax only:** `stripTypeScriptTypes` removes type annotations, interfaces, `as` casts, and `!` non-null assertions. Non-erasable syntax (`enum`, parameter properties, namespaces with runtime code) requires a separate compile step.

---

## 5. Dynamic Runtime Class Scoping & JS-Only Class Discovery

Class names referenced in JavaScript (`classList.add/remove/toggle/replace`, `.className` in selector strings, `el.className = "..."`, and `setAttribute("class", "...")`) are automatically discovered by Bascik's JS scanner and added to the component's class scope map before the JS rewrite runs.

This means dynamic modifier classes (such as `is-open` or `btn--active`) that only appear inside a `<script>` block and never in a `class="..."` HTML attribute are scoped automatically in both CSS and JS without needing any template annotations.

```html
<section class="card" id="card">
  <p id="status">Panel closed</p>
  <button id="toggle" type="button">Toggle</button>
</section>
<script>
  const toggle = document.getElementById('toggle');
  const status = document.getElementById('status');
  const card = document.getElementById('card');

  toggle.addEventListener('click', () => {
    const isOpen = card.classList.toggle('is-open'); // is-open is automatically discovered and scoped in CSS and JS
    status.textContent = isOpen ? 'Panel open' : 'Panel closed';
  });
</script>
```

The only exception is `innerHTML` / `insertAdjacentHTML` HTML string scanning, which only recognizes class names that appear as static `class="..."` attributes in the component HTML template.

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
By default Bascik skips transpilation inside `<code>` elements, so raw code examples stay literal.

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
Props in Bascik follow the same basic idea as React props, but the mechanism is plain HTML through `data-bascik-prop-*` attributes.
The `data-bascik-prop-*` marker is removed from compiled output, while the target element's other attributes are preserved.
*Props accept text values only. For rich HTML content, use slots.*

---

## 7. Attribute Inheritance & Tags

### Attribute Inheritance
Non-`data-bascik-*` attributes on a usage tag are merged onto the component's root element when `inheritAttributes` is `true` (the default). `id` is forwarded too unless the template root already defines its own `id`. Class names are appended, not replaced.

If a component template contains multiple root elements, inherited attributes are merged onto the first root HTML element in the component template.

```html
<!-- usage — attributes here are forwarded onto the component root -->
<site-nav class="sticky" aria-label="main navigation"></site-nav>

<!-- site-nav.html — component template -->
<nav class="nav"><a href="/">Home</a></nav>

<!-- compiled output — class appended, aria-label forwarded -->
<nav class="bascik__site-nav__nav sticky" aria-label="main navigation">
  <a href="/">Home</a>
</nav>
```

Inherited class names are not scoped, they are treated as global page-level classes. To disable inheritance: `inheritAttributes: false` in `bascik.config.ts`.

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
* All build scripts on a page execute concurrently via `Promise.all` (capped by a memory semaphore), and output is assembled in document order once all scripts complete.
* On error, the script tag is replaced with an empty string and a warning is logged.
* **Hard error:** combining `data-bascik-build` and `data-bascik-server` on the same tag throws and aborts the build. A script runs at build time or at request time, not both.

### Build Script Environment Variables

Build scripts receive these `process.env` variables:

| Variable | Description |
|---|---|
| `BASCIK_PAGE_FILE` | Absolute path of the current page file (e.g. `/project/src/pages/about.html`). Use this to generate page-specific output like canonical URLs. |
| `BASCIK_PAGES_DIR` | Absolute path to the configured pages directory. |
| `BASCIK_BUILD` | `"1"` during `bascik --build`, `"0"` during dev. Use to produce different output per mode. |
| `BASCIK_SITE_URL` | The `siteUrl` from `bascik.config.ts`, e.g. `"https://example.com"`. |

These are critical for scripts that generate per-page output. A script using `BASCIK_PAGE_FILE` gets a separate cache entry per page automatically.

### Build Script Output Cache

Each `<script data-bascik-build>` spawns a Node.js child process (~50–150 ms startup each). Bascik caches script output on disk so unchanged scripts skip the spawn on subsequent builds or server restarts.

**Cache location:** `node_modules/.cache/bascik/script-cache/<sha256>.json`

**Cache key:** SHA-256 of the script content + dev/build mode + the current page path (`BASCIK_PAGE_FILE`) + the site URL + the full content of any `content/*.md` or `scripts/*.{mjs,js,ts}` files referenced as quoted path literals in the script. The page path is included so that scripts like `canonical.ts` that use `process.env.BASCIK_PAGE_FILE` get a separate cache entry per page. Changing a referenced file produces a new key and a cache miss for that script only; all other scripts keep their cached output.

**To disable:** set `buildScriptCache: false` in your config (useful when debugging a script that reads external state not tracked by the cache key).

**To bust the entire cache** (e.g. after upgrading a build-time npm dependency):

```sh
rm -rf node_modules/.cache/bascik/script-cache
```

With `useWorkers: true`, multiple workers share the same cache directory. Workers that independently miss the same key both spawn a child process; last write wins with identical content. This is a minor inefficiency on a cold first build only.

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

Given this Markdown source:

```md
## A practical heading

Markdown stays comfortable for authors, while the published page stays **plain HTML**.

> Add an editorial treatment with ordinary CSS.
```

`marked()` emits:

```html
<h2>A practical heading</h2>
<p>Markdown stays comfortable for authors, while the published page stays <strong>plain HTML</strong>.</p>
<blockquote>
<p>Add an editorial treatment with ordinary CSS.</p>
</blockquote>
```

The parser emits ordinary HTML, so it can be styled by a global stylesheet or wrapped in a Bascik component. For reusable scoped styles, have the script emit `<markdown-content>${marked(md)}</markdown-content>` and give that component a default slot.

Use wrapper descendant selectors for generated slot content:

```css
.markdown-content h2 { margin-block: 2.5rem 0.75rem; }
.markdown-content blockquote { border-left: 4px solid currentColor; }
```

Do not rely on a bare `h2 {}` component rule for Markdown passed through a slot. Bare element rules are transformed before slot content is inserted; a scoped wrapper selector continues to match the generated descendants.

### Page-Aware Scripts

Some pages need content that is specific to the current page, such as a canonical URL in the head, an Open Graph image, a structured-data block, or even a page-specific sidebar. Hardcoding those values in every page file works. However, a shared script is easier to maintain. You can change the logic once and every page picks it up automatically.

Bascik makes this possible by injecting three environment variables into every `data-bascik-build` subprocess: `BASCIK_PAGE_FILE`, `BASCIK_PAGES_DIR`, and `BASCIK_SITE_URL` (described in the Environment Variables table above).

#### Canonical URL Example

A canonical URL tag tells search engines which URL is the authoritative version of a page. Every docs page on this site uses a shared `scripts/canonical.ts` that derives the URL from `BASCIK_PAGE_FILE`:

```ts
// scripts/canonical.ts
export async function canonical(): Promise<string> {
  const siteUrl = (process.env.BASCIK_SITE_URL ?? '').replace(/\/$/, '');
  const pageFile = process.env.BASCIK_PAGE_FILE ?? '';
  const pagesDir = process.env.BASCIK_PAGES_DIR ?? '';

  if (!siteUrl || !pageFile || !pagesDir) return '';

  const relPath = pageFile.slice(pagesDir.length).replace(/^[\\/]/, '').replace(/\\/g, '/');
  const withoutExt = relPath.replace(/\.html$/, '');
  const route = withoutExt === 'index' ? '' : withoutExt.replace(/\/index$/, '/');
  const urlPath = route ? `/${route}` : '/';

  return `<link rel="canonical" href="${siteUrl}${urlPath}" />`;
}
```

Use it from any page's `<head>`:

```html
<head>
  <script data-bascik-build>
    import { join } from 'node:path';
    import { pathToFileURL } from 'node:url';
    const { canonical } = await import(
      pathToFileURL(join(process.cwd(), 'scripts/canonical.ts')).href
    );
    console.log(await canonical());
  </script>
</head>
```

#### Reading the Page's Own HTML

For richer outputs, including Open Graph tags or JSON-LD structured data, a script can also read the page file itself to extract metadata. `BASCIK_PAGE_FILE` is an absolute path, so `readFile` works directly:

```ts
// scripts/article-schema.ts (simplified)
import { readFile } from 'node:fs/promises';

export async function articleSchema(): Promise<string> {
  const pageFile = process.env.BASCIK_PAGE_FILE ?? '';
  const siteUrl = (process.env.BASCIK_SITE_URL ?? '').replace(/\/$/, '');
  if (!pageFile || !siteUrl) return '';

  const html = await readFile(pageFile, 'utf8');
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
  if (!titleMatch || !descMatch) return '';

  const headline = titleMatch[1].trim();
  const description = descMatch[1].trim();
  // ... compute url, build schema object, return JSON-LD script tag
}
```

The script runs on the source HTML before any other build scripts have fired, so `<title>` and `<meta name="description">` are always present as written.

### data-bascik-dev

Tag a browser script with `data-bascik-dev` to mark it as dev-only. In development the attribute is stripped and the script runs normally in the browser. In production builds (`bascik --build`) the entire script tag is removed.

```html
<script data-bascik-dev>
  console.log('dev only — stripped from production build');
</script>
```

Useful for debug logging, development overlays, or any browser script that should never ship to production.

> **dev vs. build:** `data-bascik-build` executes at transpile time and injects HTML into the page. `data-bascik-dev` runs in the browser, but only in dev mode.

### data-bascik-server

Tag a `<script>` block with `data-bascik-server` to run it **at request time** on the server. Unlike `data-bascik-build` (which executes once at transpile time), server scripts execute on every request and are never cached. Use them to personalize pages per visitor, reading cookies, querying a database, rendering content based on query parameters.

```html
<script data-bascik-server>
  import { escapeHtml } from './lib/escape-html.mjs';

  const req = JSON.parse(process.env.BASCIK_REQUEST);
  const name = escapeHtml(req.headers['x-display-name'] ?? 'Guest');
  console.log(`<p>Welcome, ${name}!</p>`);
</script>
```

`process.env.BASCIK_REQUEST` is a JSON string with four keys:

* `path`: URL path without query string, e.g. `"/about"`
* `method`: HTTP method in uppercase, e.g. `"GET"`
* `headers`: request headers as string-to-string object (HTTP/2 pseudo-headers excluded)
* `searchParams`: parsed query params as string-to-string object

Bascik intentionally does not inject a global `escapeHtml()` helper into every server script. If you want a shared escape utility, keep it in a project file or import it explicitly.

Rules:
* Top-level `import` and `await` are supported.
* `data-bascik-server` blocks are preserved through `bascik --build` and executed at request time when served with `bascik --serve` or the dev server.
* They are NOT executed during `bascik --build` itself.
* Scripts are NOT wrapped in an IIFE (they are Node.js code, not browser JS).
* On error, a warning is logged and the tag is replaced with an empty string.

---

## 9. Configuration (`bascik.config.ts`)

Use `bascik.config.ts` (preferred) or `bascik.config.js` (takes precedence if both exist). Import `defineConfig` for full editor autocomplete and inline docs:

```ts
// bascik.config.ts
import { defineConfig } from '@bascik/bascik/config';

export default defineConfig({
  directory: {
    pages: "src/pages", // default
    components: "src/components", // default
  },
  watch: [], // re-transpile all pages when these paths change (dev only)
  exec: [
    // { script: 'scripts/generate-search-index.ts', watch: ['content/'] }, // runs sequentially in array order before page transpilation during --build; in dev, runs on startup and watched file changes
    // { script: 'scripts/generate-llms-txt.ts' },                          // build-only: skipped in dev
  ],
  scopeScriptBlocks: true,
  inheritAttributes: true,
  scopeAttribute: {
    class: true,
    id: true,
    name: true,
  },
  deduplicateCss: true,
  skipTranspilingElementContents: ['code'], // don't scope inside these elements
  minifyStyles: true,
  inlineStyles: false, // false | true | ['src/pages/css/styles.css']
  minifyScripts: true, // true (default) | false | async (js: string) => string
  obfuscateAttributeNames: true, // hash class/id names to short hex strings
  cacheHttp: false, // dev default; automatically true in --serve mode
  siteUrl: 'https://example.com',
  generate: {
    sitemap: true, // write dist/sitemap.xml
    robots: true,  // write dist/robots.txt
  },
  useWorkers: false,       // true: transpile pages across CPU-core worker threads
  buildScriptCache: true,  // false: disable disk cache for <script data-bascik-build>
  devServer: {
    logging: {
      level: 'info',    // silent | error | warn | info | debug
      requests: true,
      copies: true,
      deletes: true,
      transpiles: true,
    },
  },
  serve: {
    enableTls: false,     // default; set true for HTTP/2 HTTPS
    port: 8080,           // default (8080 HTTP, 8443 HTTPS)
    hostname: 'localhost', // use '0.0.0.0' to bind all interfaces (containers/proxies)
    keyFile: '/etc/ssl/site.key',  // optional: provide your own TLS cert
    certFile: '/etc/ssl/site.crt', // optional: provide your own TLS cert
    logging: {
      level: 'info',    // silent | error | warn | info | debug
      requests: true,
    },
  },
});

// Applied only during `bascik --build` and `bascik --serve`.
export const build = defineConfig({
  obfuscateAttributeNames: true,
  minifyStyles: true,
});
```

**`minifyScripts`:** `true` (default) strips comments and collapses whitespace — it does not mangle identifiers. Pass a custom async function to plug in esbuild, terser, or `stripTypeScriptTypes`:

```ts
import { transform } from 'esbuild';
export const build = defineConfig({
  minifyScripts: async (js) => (await transform(js, { minify: true, loader: 'js' })).code,
});
```

---

## 10. Folder Structure, 404, and 500 pages

```
src/
  pages/       ← one .html file per route (plus CSS, images, etc.)
  components/  ← component .html (+ optional .css) files
```

### Custom 404 & 500 Pages
* **404 Page (`src/pages/404.html`):** If you create a `404.html` file in your pages directory, the dev server and `bascik --serve` automatically serve it as a fallback for any non-existent routes with a `404` status code. When you build for production (`bascik --build`), this is compiled to `dist/404.html` which is recognized by standard static hosts (GitHub Pages, Vercel, Netlify).
* **500 Page Support:** If the server encounters runtime compilation errors, it responds with a proper `500` error block to prevent server crashes.

---

## 11. CLI & Development Workflow

### Scaffold a New Project

The zero-friction way to start a new Bascik project:

```sh
npm create bascik@latest my-site -y
```

This scaffolds the project, installs dependencies, and starts the dev server in one shot. You're live at **http://localhost:8080**. Pass a different name to use it as both the directory name and the site title. Omit the name to be prompted for one (defaulting to `bascik-app`). Drop `-y` to step through the install and dev server prompts manually.

The scaffold creates a complete starter site: pages, components, global CSS, `bascik.config.ts`, `.gitignore`, and AI assistant skills at `.github/skills/bascik/SKILL.md` and `.claude/skills/bascik/SKILL.md`. When the dev server stops, the CLI prints a reminder:

```
To start again:  cd my-site && npm run dev
```

### Adding to an Existing Project

```sh
npm install @bascik/bascik
```

Then run `bascik init` to scaffold the starter files and folder structure, or add the scripts manually to `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "bascik",
    "build": "bascik --build"
  }
}
```

### CLI Commands

```sh
bascik                        # dev: transpile, start plaintext HTTP server at http://localhost:8080, watch
bascik --build                # production: transpile to dist/ only
bascik --build --log [path]   # write build output to a log file (default: .bascik/build.log)
bascik --serve                # production server: serve a pre-built dist/ with HTTP
bascik --check                # static analysis: validate pages and components without building
```

**`bascik --serve`:** starts the HTTP/2 server against a pre-built `dist/` directory. **Only needed when the site uses `data-bascik-server` scripts** for per-request dynamic content (personalized dashboards, user-specific data, server-rendered pagination). Sites with no server scripts can be deployed to any static host with no runtime server required. Run `bascik --build` first, then `bascik --serve`. Unlike the dev server, `--serve` does not watch files or inject live-reload. `data-bascik-server` scripts execute per-request in both modes.

**`serve` config block:** configure the production server in `bascik.config.ts`:
```ts
export default {
  cacheHttp: true,       // default in --serve; false in dev
  serve: {
    port: 8080,            // default (8080 HTTP, 8443 HTTPS)
    hostname: 'localhost', // set '0.0.0.0' to bind all interfaces
    enableTls: false,      // default; set true for HTTP/2 HTTPS
    keyFile: 'bascik-privkey.pem',
    certFile: 'bascik-cert.pem',
  },
};
```
When `enableTls: true` is set, TLS certs are generated automatically (mkcert if available, openssl fallback) when `keyFile`/`certFile` are absent. Provide your own certs from a public CA for production.

**`cacheHttp`:** defaults to `true` in `--serve` and `false` in the dev server. When `true`: pages receive `ETag` headers and the server returns `304 Not Modified` for unchanged content; static assets get `Cache-Control: public, max-age=3600`. Set `false` if a CDN manages caching externally.

**Production hardening (automatic in `--serve`):**
* **Security headers:** every response includes `x-content-type-options: nosniff`, `x-frame-options: SAMEORIGIN`, `referrer-policy: strict-origin-when-cross-origin`, `permissions-policy: interest-cohort=()`.
* **URL routing (dev and production):** pages are served at their filename without the `.html` extension. `dist/about.html` is at `/about`, `dist/blog/post.html` is at `/blog/post`, `dist/index.html` is at `/`. Unmatched paths fall through to `/404` if a `dist/404.html` exists.
* **Rate limiting:** 500 requests per 10 seconds per IP. Clients over the limit get `429 Too Many Requests` with `Retry-After`. Not active in the dev server. When behind a reverse proxy the limit applies to the proxy's IP; use the proxy's own rate limiting for per-client control.
* **Graceful shutdown:** SIGTERM and SIGINT stop accepting connections, destroy all open sessions and live-reload SSE connections, and drain in-flight requests before exiting. Force-exits after 10 seconds if anything hasn't drained.
* **Path traversal protection:** static asset URLs are validated against `dist/`; requests that escape with `/../` sequences get `400 Bad Request`.

**Deployment:** Bascik's server runs over unencrypted HTTP/1.1 by default. Edge platforms (Heroku, Fly.io, AWS ECS, Render) that terminate TLS at the load balancer can forward cleartext HTTP directly to the container. Key patterns:

* **VPS / dedicated**: bind `hostname: '0.0.0.0'`, supply Let's Encrypt certs via `keyFile`/`certFile` with `enableTls: true`, run as a `systemd` service.
* **Docker**: multi-stage build (build stage: `npx bascik --build`; serve stage: `npx bascik --serve`).
* **PaaS (Railway, Render, Fly.io)**: set start command to `bascik --build && bascik --serve` and bind port `8080`.

When using a reverse proxy, forward `X-Real-IP` and any auth headers so `data-bascik-server` scripts receive them via `headers` in `BASCIK_REQUEST`.

### Development Workflow & Server Output
Bascik's CLI is designed to provide clean, minimal, and informative terminal output.

#### 1. Starting the Dev Server
When you start the dev server, Bascik starts the HTTP server concurrently with page transpilation so the server is already bound to its port by the time the last page finishes. The `Server running at` line prints immediately after the transpilation summary with no gap between them. Pages are served from memory with no disk I/O at request time in dev mode. If port 8080 is in use, Bascik automatically tries the next available port (8081, 8082, etc.).

```terminal
transpiled: pages/getting-started.html
transpiled: pages/index.html
transpiled: pages/about.html

✓ 3 pages transpiled in 45ms
Server running at http://localhost:8080
```

On startup, Bascik computes the full component list and global styles **once**, then transpiles all pages. By default pages transpile sequentially on the main thread; setting `useWorkers: true` in `bascik.config.ts` distributes them across a pool of CPU-core worker threads instead. Worker startup has a fixed cost (each worker loads the transpiler's module graph independently), so `useWorkers` is opt-in and best suited to larger sites or CPU-heavy per-page work, small sites are usually faster with the sequential default. Brotli compression for each page runs in the background after storage and does not block the page from being marked ready or served; the server falls back to serving uncompressed content for any request that arrives before compression finishes. The server becomes ready as soon as memory is populated; no writes to `dist/` happen during dev mode.

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
  copied: pages/css/custom.css
  ```
* **Deleting Pages:** Removing a page from your pages directory automatically cleans up its compiled output counterpart to prevent dead files:
  ```terminal
  deleted file: pages/old-page.html
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
* **Errors:** hyphenated tags with no matching component file (the tag renders as-is in the HTML output):
  ```terminal
  [bascik check] Unknown component in "pages/about.html": <my-missing> — no matching component file found
  ```
* **Warnings:** component files that are never referenced:
  ```terminal
  [bascik check] Unused component: <old-widget> — defined but never referenced
  ```
* **Success**:
  ```terminal
  [bascik check] ✓ 8 pages and 12 components checked — no errors
  ```

Exits with code `1` on errors, suitable for CI:
```sh
bascik --check && bascik --build
```

**What `bascik --check` does not cover:** it validates component references only, not CSS or JavaScript syntax. A CSS syntax error can cause bascik's scoping transforms to produce garbled output without any warning. Use external tools alongside `--check`:

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

**VS Code fix:** add `.vscode/settings.json`:
```json
{ "html.validate.scripts": false }
```

Commit this file so all contributors get the correct behaviour automatically. Alternatively, add `// @ts-nocheck` as the first line inside any individual script block that triggers the warning.

#### 5. Inspecting `dist/` Output

Both the dev server and `bascik --build` write compiled HTML to `dist/` on disk, this is the ground truth of what Bascik produced. The `dist/` structure mirrors `src/pages/` with the leading directory stripped:

```
src/pages/about.html       →  dist/about.html
src/pages/blog/post.html   →  dist/blog/post.html
```

What to check in compiled output:
* **Component resolution:** every custom tag (e.g. `<site-nav>`) should be replaced with expanded HTML. A hyphenated tag still present in `dist/` means no component file matched.
* **Scoped class names:** attributes like `class="bascik__site-nav__nav"` (or a short hash with `obfuscateAttributeNames`) confirm CSS scoping ran correctly.
* **Injected `<style>` block:** the `<head>` should contain one combined `<style>` with CSS from all components used on that page.
* **Build script output:** `<script data-bascik-build>` is replaced with stdout; if missing, check the terminal for a `[bascik] build script error` line.
* **Server script output:** `<script data-bascik-server>` is replaced at request time; if output is missing on a live request, check the terminal for a `[bascik] server script error` line. Remember these scripts run in Node.js, not the browser, they require `bascik --serve` or the dev server to execute.
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

**Required config:** disable class scoping in `bascik.config.ts`:
```ts
export default {
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
* **HTMX:** Uses `hx-get`, `hx-post` attributes for server-driven partial updates.
* **Stimulus:** Uses `data-controller` for attaching behavior to DOM structures.
* **Chart.js, D3, Leaflet:** Mounts to elements via `getElementById`; Bascik rewrites the ID and matching selectors at build-time so they stay in sync.

---

## 13. Testing

Bascik has two test suites, both run from `pkg/`.

### Unit Tests (Vitest)

```sh
yarn pkg:test          # watch mode
yarn pkg:test:ci       # single run (CI)
yarn pkg:test:coverage # with coverage report
yarn pkg:bench         # benchmarks
```

Each `pkg/src/lib/*.ts` module has a paired `*.test.ts`. Because modules depend on `BascikConfig` (a singleton), unit tests use `vi.mock('../config.ts', ...)` to stub configuration, then import the module under test **after** the mock call.

### End-to-End Tests (Playwright)

```sh
yarn pkg:build && yarn pkg:e2e   # build package first, then run all e2e tests
```

The e2e suite lives in `pkg/e2e/`. Playwright's `webServer` hook:
1. Builds the fixture site (`pkg/e2e/src/`) using the current `pkg/dist/`
2. Serves `e2e/dist/` on `http://localhost:4200`

The fixture config sets `obfuscateAttributeNames: false` so Playwright selectors can use readable scoped names like `bascik__my-comp__btn` instead of opaque hashes.

**Adding a new e2e test:**
1. Add a component in `pkg/e2e/src/components/my-feature/`
2. Add a page in `pkg/e2e/src/pages/my-feature-test.html` with two or more instances (to verify isolation)
3. Add `pkg/e2e/tests/my-feature.test.ts` using the standard pattern:

```ts
import { test, expect } from '@playwright/test';

test.describe('my-feature-test page', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/my-feature-test'); });

  test('instances are isolated', async ({ page }) => {
    const a = page.locator('.bascik__my-feature__wrapper').nth(0);
    const b = page.locator('.bascik__my-feature__wrapper').nth(1);
    // assert A and B are independent
  });
});
```

There are 44 e2e test files covering CSS scoping, JS scoping, slots, props, attribute inheritance, animations, observers, SVG, and head components.

### Testing JavaScript in a Bascik Project

Browser component scripts are IIFE-based and not directly importable. The recommended pattern for testing complex client-side logic:

1. **Extract pure functions** (no DOM, no `fetch`) into a sibling `.mjs` module that exports them — e.g. `search-logic.mjs` alongside `docs-search.html`.
2. **Combine at build time**: use a `<script data-bascik-build>` to read both the logic module and a DOM-wiring `.js` file, strip `export` keywords from the module, and output a single `<script>` containing one IIFE with all functions inside it. This keeps esbuild minification working correctly (no cross-script boundary renames).
3. **Test the module with Vitest**: import the `.mjs` file directly in a `*.test.mjs` file. No browser or DOM required for pure function tests.

**What to test vs. skip:** DOM wiring (adding event listeners, toggling visibility) is low value to test because it depends on the compiled output. Pure data functions (parsing, scoring, formatting) are high value. Extract those into a `.mjs` module and test them with Vitest. Configure Vitest in `vite.config.js`:

```js
// vite.config.js
import { defineConfig } from 'vite';
export default defineConfig({
  test: {
    include: ['src/**/*.test.mjs'],
  },
});
```

**Server scripts** (`data-bascik-server`): test the business logic as pure functions in a `.mjs` module; test the HTTP layer with integration tests that POST to the dev server, not by importing the script.

---

## 14. CI / CD

Two GitHub Actions workflows handle all automation.

**CI** (`.github/workflows/ci.yml`) — runs on every push to `main` and every PR, two parallel jobs on Node 24:
- `test`: runs `yarn pkg:test:ci` (unit tests with coverage)
- `e2e`: builds the package (`yarn pkg:build`), installs Chromium via `playwright install --with-deps chromium`, then runs `yarn pkg:e2e` (Playwright tests)
- Both jobs have `permissions: contents: read`

**Release** (`.github/workflows/release.yml`) — triggers on version tags:

| Package | Tag | Job guard |
|---|---|---|
| `@bascik/bascik` | `v*.*.*` | `if: startsWith(github.ref_name, 'v')` |
| `create-bascik` | `create-v*.*.*` | `if: startsWith(github.ref_name, 'create-v')` |

Both release jobs: install → test → build → `npm publish --provenance --access public`.

- `--provenance` requires `id-token: write` permission; generates a signed attestation on npmjs.com linking the package to the Actions run.
- Both `package.json` files also declare `"publishConfig": { "access": "public" }`.
- Requires the `NPM_TOKEN` repository secret (Settings → Secrets and variables → Actions).

**Tagging a release:**
```sh
# @bascik/bascik
git tag v1.2.0 && git push origin main --tags

# create-bascik
git tag create-v1.0.3 && git push origin main --tags
```

`dist/` is never committed to git — the workflow always builds it fresh.

---

## 15. VS Code Extension

The `extensions/vscode-bascik/` package provides editor tooling:

* **Command-click navigation:** click a component tag like `<site-nav>` to jump to `src/components/site-nav/site-nav.html`.
* **Inline warnings:** flags CSS patterns Bascik cannot safely scope (standalone attribute selectors, element names inside `:is()`/`:where()`/`:has()`) and JS patterns that won't be rewritten (`.id =` setter, template-literal class names, `style.setProperty('--var', …)`).
* **Rules generated from the compatibility matrix:** `docs/scripts/generate-compatibility-rules.mjs` reads `docs/content/compatibility.md` and writes the warning rules, so editor diagnostics stay in sync with the documented capability table automatically.

To install locally: open `extensions/vscode-bascik/` in VS Code and press F5.

---

## 16. Lighthouse 100s & Performance

Bascik gives you an enormous head start on Lighthouse scores. Because it outputs plain HTML with zero framework runtime, you begin every page with near-perfect scores. Reaching 100 across all four Lighthouse categories is a matter of applying a small, well-known set of HTML patterns.

### What Bascik Does
* **Zero runtime:** The most impactful thing Bascik does is what it does not add: no framework bundle, no hydration script, and no client-side router. The only JavaScript on any page is what you wrote.
* **CSS deduplication:** When a component appears multiple times on a page, Bascik emits a single `<style>` block regardless of instance count.
* **HTML minification:** HTML comments are stripped and excess whitespace is collapsed in every built page. Content inside `<pre>` blocks is left intact.
* **Script minification:** `minifyScripts` is `true` by default, stripping comments and whitespace.
* **Inline styles:** Set `inlineStyles` in `bascik.config.ts` to inject a stylesheet directly into `<head>`, eliminating the render-blocking HTTP request.

### Performance Patterns for Developers
* **Responsive Images (`srcset`):** Avoid sending oversized images. Use `srcset` density or width descriptors, and always include explicit `width` and `height` attributes to prevent Cumulative Layout Shift (CLS).
* **Lazy Loading (`loading="lazy"`):** Add `loading="lazy"` to below-the-fold images and iframes. Do not lazy-load above-the-fold hero images.
* **Preloading (`<link rel="preload">`):** Preload critical first-render assets, such as your hero image, critical web fonts, or early stylesheets.
* **Prefetching (`<link rel="prefetch">`):** Fetch resources or future pages during idle time if a navigation is highly likely.
* **Preconnect / DNS Prefetch:** For critical third-party domains, resolve DNS and negotiate connections early using `dns-prefetch` and `preconnect`.
* **Async and Deferred Scripts:** Use `defer` for scripts that need the DOM ready, and `async` for fully independent scripts like analytics.

---

## 17. Switch to Bascik

Detailed per-framework migration guides live at `/switch/*`. Key patterns that apply across all migrations:

- **Component files:** Rename to hyphenated `.html` files in `src/components/<name>/`. Remove framework-specific syntax (`<template>`, JSX, `.astro` frontmatter fences). The HTML file is just the component markup.
- **Scoped styles:** Delete framework scoped-style blocks (`<style scoped>`, `.module.css`). Create a paired `.css` file alongside the component HTML. Class names stay the same; Bascik scopes them at build time.
- **Slots:** `<slot />` / `children` → `data-bascik-slot` (no value) for default, `data-bascik-slot="name"` for named slots.
- **Props:** `defineProps` / component props → `data-bascik-prop-*` attributes (text only).
- **Reactive state:** `ref`, `useState`, etc. → plain `<script>` with vanilla JS. Bascik scopes `id` values so multiple instances stay independent.
- **Routing:** Client-side router → one `.html` file per URL in `src/pages/`. No dynamic segments; generate static files for parameterized routes.
- **Build-time data:** `onMounted` / `getStaticProps` / frontmatter → `<script data-bascik-build>` (Node.js ESM, stdout injected).

### From Svelte

Full guide: `/switch/from-svelte`. Key Svelte-specific mappings:

| Svelte | Bascik |
|--------|--------|
| `.svelte` file (`<script>` + markup + `<style>`) | `.html` + `.css` paired files |
| `children` snippet / `{@render children()}` (Svelte 5) | `data-bascik-slot` (no value) |
| `<slot />` (Svelte 4, deprecated) | `data-bascik-slot` (no value) |
| Named snippet prop / `{#snippet header()}` (Svelte 5) | `data-bascik-slot="x"` |
| `<slot name="x" />` (Svelte 4, deprecated) | `data-bascik-slot="x"` |
| `$props()` / `export let` | `data-bascik-prop-*` attributes |
| `$state()` / reactive variables | Vanilla JS `<script>` |
| `{#if}` / `{#each}` | Static HTML or `<script data-bascik-build>` |
| SvelteKit file routing (`+page.svelte`) | One `.html` per route in `src/pages/` |
| `onMount` data fetch | `<script data-bascik-build>` (build time) or `<script>` (runtime) |

### From Vue

Full guide: `/switch/from-vue`. Key Vue-specific mappings:

| Vue | Bascik |
|-----|--------|
| `<template>` + `<style scoped>` | `.html` + `.css` paired files |
| `<slot />` | `data-bascik-slot` (no value) |
| `<slot name="x" />` | `data-bascik-slot="x"` |
| `defineProps` | `data-bascik-prop-*` attributes |
| `ref` / `reactive` | Vanilla JS `<script>` |
| `v-if` / `v-show` | CSS `display:none` or JS toggle |
| `vue-router` | One `.html` per route in `src/pages/` |
| `onMounted` data fetch | `<script data-bascik-build>` |

---

## 18. Key Constraints & Rules for AI Code Generation (MUST FOLLOW)

When generating code, pages, or components for a Bascik project, the following conventions are strictly enforced:

1. **Hyphenated Custom Tags:** Component tag names must be hyphenated (e.g. `my-nav`, `site-header`). Single-word tags are not valid custom element names.
2. **Scoping Rules:** CSS scoping only applies to paired `.css` files and inline `<style>` tags inside component HTML.
3. **Selector Rewrites:** CSS `#id {}` hash selectors are converted to component-scoped class selectors; the class is automatically injected onto the matching element. The `[id]` attribute-selector form is stripped.
4. **Script Selectors:** Use `id` and `class` selectors in JS that exactly match the attributes in the component HTML, Bascik rewrites them at build time.
5. **DOM Traversal:** For compound DOM queries, query by a single scoped `id` first, then traverse from the returned element.
6. **Dynamic Toggles:** Use `data-` attributes for runtime state that changes via JavaScript (e.g. `data-state="open"`). Scoped class names are assigned at build time and cannot be reliably looked up by JS string manipulation *unless* you utilize a scoping helper (Section 5).
7. **Text Props:** Props accept text only. For rich HTML content, use slots.
8. **Script Modules:** `<script type="module">` scripts are not wrapped in an IIFE, but their selectors are still rewritten.
9. **Non-JS Script Types:** Script tags with any `type` other than `text/javascript` (e.g. `type="application/json"`) are left completely untouched — no IIFE wrapping, no selector rewriting.
10. **Literal Tag Text Is Safe:** Component tag text inside `<script>`, `<style>`, or `<textarea>` content (e.g. `<my-card>` in a JSON-LD string or code example) is treated as text and never resolved into a component.

---

## 19. FAQ

**How do you pronounce Bascik? Where does the name come from?** Just like "basic." The idea is basic, the implementation is basic in theory, and the usage is basic. The spelling comes from the author's maternal grandmother's maiden name — so it's unique and means something personal.

**Isn't BASIC already a programming language?** Yes — the classic one from the 1960s. Used it on an old Texas Instruments calculator. Enough time has passed; it can take on new meaning.

**Who made Bascik?** Collin Thomas.

**Why was Bascik created?** To build the fastest possible websites and dashboards with components, using only foundational languages (HTML, CSS, JavaScript) — no abstraction layer, no tool to learn, no JavaScript at runtime as a bottleneck.

**What happens if a component file is named after a native HTML element (e.g. `nav.html`)?**
Bascik logs a warning and still loads the component, but it will replace every occurrence of that element in pages with the component content, almost certainly breaking the site. Always use a hyphenated component name (e.g. `site-nav.html`).

**What happens with uppercase letters in a component filename (e.g. `My-Card.html`)?**
Component names are normalized to lowercase at load time. `My-Card.html` registers as `my-card` and is referenced as `<my-card>`. If two files differ only in case, the last one loaded wins. Convention: always use lowercase, hyphenated filenames.
