## Scoped CSS

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
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

```css
/* compiled output */
.bascik__site-nav__a1b2c3__nav a { color: white; }
.bascik__site-nav__a1b2c3__el__p { margin: 0; }
@keyframes bascik__site-nav__a1b2c3__keyframe__fade { ... }
```

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
