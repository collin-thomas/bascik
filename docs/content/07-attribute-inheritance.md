## Attribute Inheritance

Non-`data-bascik-*` attributes on a component usage tag are automatically merged onto the component's root element. `id` is excluded.

### How It Works

When Bascik transpiles a component, it reads the usage tag, extracts any inheritable attributes, and merges them onto the first element of the compiled output.

```html
<!-- usage -->
<site-nav
  class="sticky"
  aria-label="main navigation"
  data-testid="main-nav">
</site-nav>
```

```html
<!-- site-nav.html -->
<nav class="nav">
  <a href="/">Home</a>
</nav>
```

```html
<!-- compiled output -->
<nav
  class="bascik__site-nav__x1__nav sticky"
  aria-label="main navigation"
  data-testid="main-nav">
  <a href="/">Home</a>
</nav>
```

### Class Merging

When the root element already has a scoped `class` attribute, the inherited class is **appended** rather than replacing it.

```html
<!-- root element has scoped class -->
<nav class="bascik__site-nav__x1__nav">...</nav>

<!-- after merging class="sticky" -->
<nav class="bascik__site-nav__x1__nav sticky">...</nav>
```

### What Gets Inherited

All attributes on the usage tag are inherited **except**:

- Any `data-bascik-*` attribute — these are consumed by Bascik for slots, props, etc.
- `id` — not inherited to avoid conflicting with the component template's own scoped IDs.

Common use cases for inheritance:

- **Layout classes** — `class="sticky"`, `class="hidden"`
- **Accessibility** — `aria-label`, `role`, `aria-hidden`
- **Testing hooks** — `data-testid`, `data-cy`
- **Custom data** — any `data-*` attribute (except `data-bascik-*`)

### Interaction with Scoped Classes

Inherited class names are _not_ scoped — they are treated as global classes. This is intentional: you are passing a page-level concern onto the component's root element.

```html
<my-card class="featured">
  <p>Featured content</p>
</my-card>
```

The `featured` class is a global class that you define in your page-level stylesheet, separate from the component's scoped CSS.

> **Self-closing syntax works too:** Attribute inheritance works with both paired and self-closing usage syntax: `<my-icon class="large" aria-hidden="true" />`
