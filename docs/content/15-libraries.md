## JavaScript Libraries

Bascik adds zero JavaScript to output pages by default, but places no restrictions on including external libraries.

### How to Include

Add a CDN `<script src>` tag to the page `<head>` or a shared head component. Bascik passes external script tags through completely unchanged.

```html
<head>
  <script src="https://unpkg.com/petite-vue" defer init></script>
</head>
```

Or co-locate the CDN tag inside a component file so it only loads on pages that use the component.

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

### Scoping Compatibility

Bascik only scopes `class`, `id`, and `name` attributes at build time. Library-specific attributes (`v-scope`, `x-data`, `@click`, `hx-get`, `data-controller`) are never touched.

**Important:** Class or ID values set dynamically at runtime by a library (e.g. `:class="activeClass"`) are runtime strings and do not correspond to Bascik-scoped names. Use `data-*` attributes for runtime-toggled state and target them with `[data-state="active"]` CSS selectors.

### Any Library Works

- **HTMX** — `hx-get`, `hx-post` attributes for server-driven partial updates
- **Stimulus** — `data-controller` for attaching behavior to DOM structure
- **Chart.js, D3, Leaflet** — mount to an element via `getElementById`; Bascik rewrites the ID and matching selector at build time so they stay in sync

CDN `<script src>` tags are never modified by Bascik.
