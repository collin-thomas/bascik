# Slots

Slots let you pass inner HTML content into a component at the usage site. Bascik supports a default slot, named slots, and slot fallback content.

## Default Slot

Add `data-bascik-slot` (no value) to any element in your component template to mark where inner content should be inserted. The element itself is replaced by the slot content.

```html
<!-- my-card.html -->
<div class="card">
  <div data-bascik-slot></div>
</div>
```

Usage:

```html
<my-card>
  <h2>Card Title</h2>
  <p>Card body text.</p>
</my-card>
```

Output:

```html
<div class="card">
  <h2>Card Title</h2>
  <p>Card body text.</p>
</div>
```

## Slot Fallback Content

Place default content inside the slot marker. It renders when the usage site passes no inner content.

```html
<!-- my-card.html -->
<div class="card">
  <div data-bascik-slot><p>No content provided.</p></div>
</div>
```

```html
<!-- No inner content - fallback renders -->
<my-card></my-card>

<!-- Inner content provided - overrides fallback -->
<my-card><p>Custom content.</p></my-card>
```

## Named Slots

Use `data-bascik-slot="name"` in the component template to define named slot zones. At the usage site, wrap content for each zone with the same attribute.

In the component template:

```html
<!-- page-layout.html -->
<div class="layout">
  <header>
    <div data-bascik-slot="header"></div>
  </header>
  <main>
    <div data-bascik-slot></div>
  </main>
  <aside>
    <div data-bascik-slot="sidebar"></div>
  </aside>
</div>
```

At the usage site:

```html
<!-- index.html -->
<page-layout>
  <p>Main body content.</p>

  <div data-bascik-slot="header">
    <h1>Page Title</h1>
  </div>

  <div data-bascik-slot="sidebar">
    <nav>Sidebar nav</nav>
  </div>
</page-layout>
```

> **How it works:** Named slot wrappers in the usage inner HTML are extracted by name and injected into the matching `data-bascik-slot="name"` placeholder in the template. Everything left over goes into the default slot.

## Whitespace Handling

Leading and trailing whitespace is trimmed from all slot content at build time. This means you can write component usage on multiple lines without worrying about stray newlines or indentation appearing in the output:

```html
<!-- these two usages produce identical output -->

<my-card><p>Hello</p></my-card>

<my-card>
  <p>Hello</p>
</my-card>
```

Whitespace *within* slot content is preserved exactly as written.

> **Code examples stay literal by default.** Bascik skips transpilation inside `<code>` elements by default, so slot trimming only applies to regular component resolution. If you opt into `skipTranspilingElementContents: ['code', 'pre']`, raw `<pre>` content is preserved too.

> **MDN reference.** Bascik slots are build-time insertion points built with standard HTML plus `data-*` attributes. For the actual elements you place into slots, treat [MDN's HTML reference](https://developer.mozilla.org/en-US/docs/Web/HTML) as the primary source of truth.

## Interactive Demo

This demo uses two named slots (`eyebrow` and `actions`) plus the default slot for the body content.

<!-- demo:source-usage -->
```html
<slot-layout-demo>
  <span data-bascik-slot="eyebrow">Named slot</span>
  <span data-bascik-slot="title">Build-time slot layout</span>
  <p>Use named slots for fixed regions and the default slot for body content.</p>
  <a data-bascik-slot="actions" href="/configuration">Read configuration</a>
</slot-layout-demo>
```

<!-- demo:source-html -->
```html
<section class="slot-panel">
  <header class="slot-panel-header">
    <p class="slot-panel-eyebrow">
      <span data-bascik-slot="eyebrow">Overview</span>
    </p>
    <h3 class="slot-panel-title">
      <span data-bascik-slot="title">Fallback title</span>
    </h3>
  </header>

  <div class="slot-panel-body">
    <div data-bascik-slot>
      <p>Fallback body copy.</p>
    </div>
  </div>

  <footer class="slot-panel-actions">
    <div data-bascik-slot="actions">
      <a href="/getting-started">Read docs</a>
    </div>
  </footer>
</section>
```

<!-- demo:source-css -->
```css
.slot-panel {
  width: min(100%, 34rem);
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 24px;
}

.slot-panel-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.slot-panel-eyebrow {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}

.slot-panel-title {
  margin: 0;
  font-size: 1.1rem;
}

.slot-panel-actions {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.slot-panel-actions a {
  display: inline-flex;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
}
```

<!-- demo:output-html -->
```html
<section class="bascik__slot-layout-demo__slot-panel">
  <header class="bascik__slot-layout-demo__slot-panel-header">
    <p class="bascik__slot-layout-demo__slot-panel-eyebrow">Named slot</p>
    <h3 class="bascik__slot-layout-demo__slot-panel-title">Build-time slot layout</h3>
  </header>

  <div class="bascik__slot-layout-demo__slot-panel-body">
    <p>Use named slots for fixed regions and the default slot for the main body content.</p>
  </div>

  <footer class="bascik__slot-layout-demo__slot-panel-actions">
    <a href="/configuration">Read configuration</a>
  </footer>
</section>
```
