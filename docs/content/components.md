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
