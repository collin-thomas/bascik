## Bascik vs Frameworks

Bascik is not a framework. It is a build tool that resolves HTML components at compile time and then gets out of the way. No runtime ships to the browser. There is no framework-owned component library or request lifecycle to learn. The output is plain HTML.

That distinction matters when choosing a tool, so this page compares Bascik against lightweight frameworks that are often considered in the same conversation.

### What Bascik Does

Bascik solves one problem: component reuse at build time. Write a navigation bar once, use it on every page, and get clean HTML out. That is the entire scope.

Everything else — interactivity, server communication, reactive state — is your decision. You can ship zero JavaScript, or you can add as much as the project needs. Bascik does not have an opinion.

The custom component tags in a Bascik project are the ones **you create**. If you create `site-nav.html`, you can write `<site-nav>`. Bascik does not add a catalog of framework components with their own behavior or API.

Bascik does use a small set of build instructions such as `data-bascik-slot`, `data-bascik-prop-*`, and `data-bascik-build`. They follow HTML's standard `data-*` extension mechanism, so browsers parse them as valid custom data attributes. Bascik consumes them during the build; they are not runtime directives that require browser JavaScript to interpret.

### HTMX

[HTMX](https://htmx.org) is a popular library that extends HTML with server-driven partial updates. You add attributes like `hx-get`, `hx-post`, `hx-target`, and `hx-swap` to elements, and HTMX intercepts the resulting events, fires requests to your server, and swaps portions of the page with the response.

**What HTMX adds to a page:**

- ~14 KB of JavaScript (minified and gzipped) loaded on every page
- A new attribute vocabulary to learn and maintain (`hx-get`, `hx-post`, `hx-target`, `hx-swap`, `hx-trigger`, `hx-push-url`, `hx-select`, `hx-boost`, and more)
- A server requirement — HTMX works best when the backend returns HTML fragments

HTMX is well-suited to applications that need dynamic server-driven updates without a full JavaScript client. It is not suited to pages that are mostly static, where the overhead of loading and running a JavaScript library is not justified.

Bascik produces plain HTML. HTMX ships a JavaScript runtime. These are different tools aimed at different problems. For pages that genuinely need server-driven interactivity, you can use HTMX alongside Bascik — Bascik handles component organization at build time, and HTMX handles server communication at runtime.

```html
<!-- Bascik component that includes HTMX attributes — fully compatible -->
<button hx-get="/api/items" hx-target="#list" hx-swap="innerHTML">
  Load items
</button>
```

### Vue and React

Full-featured frameworks like Vue and React solve a different problem: client-side applications with complex reactive state, component trees, and client-side routing. They ship a significant JavaScript runtime (~40–100+ KB), require a bundler, and introduce a complete component model with lifecycle hooks, reactivity systems, and state management conventions.

For documents — marketing sites, docs portals, blogs, portfolios — most of that machinery is unused. The framework runtime loads and runs on every page visit in exchange for features the page does not use.

Bascik's component model lives entirely at build time. There is no runtime equivalent. A `<site-nav>` tag in source becomes a `<nav>` element in output — no JavaScript involved.

For sites that need selective reactivity on specific components, petite-vue (~5 KB) is a better fit than full Vue. See the [JavaScript Libraries](/libraries) page for examples.

### Alpine.js

[Alpine.js](https://alpinejs.dev) (~16 KB) occupies similar territory to HTMX: a declarative attribute-based system for adding behavior to HTML. Alpine uses `x-data` for state, `x-bind` / `@click` / `x-show` for DOM interactions.

Like HTMX, Alpine is compatible with Bascik. Bascik resolves components at build time; Alpine runs in the browser on whatever HTML Bascik produced.

### The Key Difference

| Tool | Runtime shipped | Components or API to learn | Attribute / source syntax | Requires server |
| --- | ---: | --- | --- | --- |
| **Bascik** | None | Only the components you create, plus slots and props | Standards-valid `data-bascik-*` attributes, consumed at build time | No |
| **HTMX** | ~14 KB | Request, target, swap, trigger, and history concepts | `hx-*` custom attributes interpreted at runtime | Usually |
| **Alpine.js** | ~16 KB | Alpine state and directive model | `x-*` and `@*` directives interpreted at runtime | No |
| **petite-vue** | ~5 KB | Vue reactivity and directive model | `v-*` and `@*` directives interpreted at runtime | No |
| **Vue / React** | 40–100+ KB | Framework component model, lifecycle, and state APIs | Vue directives/templates or React JSX | No |

The browser can parse Bascik's source without needing to understand a new runtime language: custom tags are valid custom-element-shaped HTML names, and build instructions use the web platform's `data-*` convention. Bascik resolves both before deployment. By contrast, runtime directives such as `hx-get`, `x-data`, and `v-scope` only gain behavior after their library's JavaScript loads.

Bascik does not compete with any of these tools for what they are good at. It fills the gap they leave open: component organization without a runtime. You can use Bascik as the build layer and any of the above as the interactivity layer — they compose cleanly.

> **Combining tools.** A common pattern is Bascik for layout components (nav, footer, hero sections) and HTMX or Alpine for specific interactive elements. Each tool does what it is best at, and neither one intrudes on the other's domain.
