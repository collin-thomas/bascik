## Component Format

A component is one `.html` file in `src/components/`. Its tag name is derived from the file name.

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

Self-closing syntax works too: `<site-nav />`

> **No restart needed.** The dev server watches the components directory. Drop a new `.html` (or paired `.css`) file in and all pages that use that tag are automatically re-transpiled and reloaded — no server restart required.
