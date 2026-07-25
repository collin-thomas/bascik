## JavaScript Libraries

Bascik adds zero JavaScript to your pages — but that is a default, not a rule. You are free to include any JavaScript library you want. CDN-delivered libraries, bundled scripts, and lightweight reactivity tools all work alongside Bascik without any special configuration.

### How to Include a Library

Add a `<script src>` tag to your page's `<head>` or to a shared head component. Bascik passes external script tags through completely unchanged — only inline `<script>` blocks with component-scoped selectors are rewritten.

```html
<!-- src/pages/index.html -->
<head>
  <title>My Site</title>
  <link rel="stylesheet" href="/css/styles.css" />
  <!-- petite-vue from CDN — passed through unchanged by Bascik -->
  <script src="https://unpkg.com/petite-vue" defer init></script>
</head>
```

Alternatively, co-locate the script tag inside the component file so the library is only loaded on pages that actually use the component:

```html
<!-- src/components/my-counter.html -->
<div v-scope="{ count: 0 }">
  <button @click="count--">−</button>
  <strong>{{ count }}</strong>
  <button @click="count++">+</button>
</div>
<script src="https://unpkg.com/petite-vue" defer init></script>
```

> **Tip:** If multiple components on the same page all include the same CDN `<script src>` tag, the browser deduplicates requests via HTTP caching. For cleaner output, place the shared CDN tag in a head component instead.

### petite-vue

[petite-vue](https://github.com/vuejs/petite-vue) is a ~5 KB subset of Vue optimized for progressive enhancement. It auto-mounts any element with a `v-scope` attribute, giving it isolated reactive state — no build step, no bundler.

Include it once with the `init` attribute and it mounts all `v-scope` elements on the page automatically:

```html
<script src="https://unpkg.com/petite-vue" defer init></script>
```

#### Reactive Counter

Each instance of this component has its own isolated state. Place it on a page as many times as you want — the counters are independent:

```html
<!-- src/components/my-counter.html -->
<div class="counter" v-scope="{ count: 0 }">
  <button class="btn" @click="count--">−</button>
  <span class="count-value">{{ count }}</span>
  <button class="btn btn-primary" @click="count++">+</button>
</div>
```

```html
<!-- Two independent instances -->
<my-counter></my-counter>
<my-counter></my-counter>
```

#### Live Filter

petite-vue's `v-for` and `v-model` work as expected. Filter a list in real time without writing any manual DOM manipulation:

```html
<!-- src/components/item-filter.html -->
<div v-scope="{
  query: '',
  items: ['Astro', 'Eleventy', 'Next.js', 'Nuxt', 'SvelteKit']
}">
  <input type="search" v-model="query" placeholder="Filter frameworks…" />
  <ul>
    <template v-for="item in items.filter(i =>
      i.toLowerCase().includes(query.toLowerCase())
    )">
      <li>{{ item }}</li>
    </template>
  </ul>
</div>
```

#### Shared State Across Components

For state that needs to be shared between separate components, define it in a plain JavaScript module and import it in a `data-bascik-build` script or a regular `<script type="module">`:

```js
// src/pages/store.js — imported by components that share state
import { reactive } from 'https://unpkg.com/petite-vue?module';
export const store = reactive({ cart: [] });
```

```html
<!-- src/components/cart-button.html -->
<script type="module">
  import { createApp } from 'https://unpkg.com/petite-vue?module';
  import { store } from '/store.js';
  createApp({ store }).mount('#cart-root');
</script>
<div id="cart-root" v-scope="{ store }">
  Cart ({{ store.cart.length }})
</div>
```

### Alpine.js

[Alpine.js](https://alpinejs.dev) is another lightweight option for adding reactive behavior. It uses `x-data` for state, `@click` / `x-on` for events, and `x-show` / `x-bind` for DOM updates — all declaratively in the HTML.

```html
<!-- src/components/disclosure.html -->
<div x-data="{ open: false }">
  <button @click="open = !open">
    Toggle details
  </button>
  <p x-show="open">
    Here is the hidden content.
  </p>
</div>
<script src="https://unpkg.com/alpinejs" defer></script>
```

### Any Library Works

Bascik places no restrictions on which libraries you use. A few common patterns:

- **[HTMX](https://htmx.org)** — add `hx-get`, `hx-post` attributes to elements for server-driven partial updates.
- **[Stimulus](https://stimulus.hotwired.dev)** — attach controllers to elements via `data-controller`; pairs well with Bascik's component structure.
- **Chart.js, D3, Leaflet** — include via CDN and initialize with a `<script>` block in the component. Bascik scopes the ID selector used to find the mount element automatically.

```html
<!-- src/components/bar-chart.html -->
<canvas id="my-chart"></canvas>
<script src="https://cdn.jsdelivr.net/npm/chart.js" defer></script>
<script>
  // Bascik rewrites "my-chart" to the scoped id at build time
  document.addEventListener('DOMContentLoaded', () => {
    const ctx = document.getElementById('my-chart');
    new Chart(ctx, { type: 'bar', data: { /* … */ } });
  });
</script>
```

### Scoping Compatibility

**Bascik scopes `class`, `id`, and `name` attributes at build time.** Library-specific attributes — `v-scope`, `x-data`, `@click`, `hx-get`, `data-controller` — are never touched.

One thing to be aware of: if a library dynamically sets a class or ID value at runtime (e.g. `:class="activeClass"` where `activeClass` is a JavaScript variable), that value is a runtime string and will *not* correspond to a Bascik-scoped class name. Use `data-*` attributes for runtime-toggled state and target them with CSS `[data-state="active"]` selectors.
