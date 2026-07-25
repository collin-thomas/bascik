## Scoped CSS

Bascik automatically namespaces your component CSS at build time. Class names, element selectors, `@media` queries, and `@keyframes` are all scoped so components can never conflict with one another.

### CSS File Pairing

Create a `.css` file with the same name in the same directory as the component HTML:

```text
src/components/
  site-nav/
    site-nav.html
    site-nav.css  ← scoped to site-nav
```

### Class Scoping

Every class name in the `.css` file is prefixed with a unique instance ID. The corresponding HTML attributes are updated to match.

```css
/* site-nav.css — source */
.navigation ul { list-style-type: none; }
.navigation ul li a { padding: 8px; }
```

```css
/* compiled output */
.bascik__site-nav__a1b2c3__navigation ul { list-style-type: none; }
.bascik__site-nav__a1b2c3__navigation ul li a { padding: 8px; }
```

### Element Selector Scoping

Bare element selectors like `p {}` or `h2 {}` are converted to generated class selectors and injected onto matching elements inside the component.

```css
/* my-comp.css — source */
p { color: #d3ff8d; }
h2 { font-size: 2rem; }
```

```css
/* compiled output */
.bascik__my-comp__x1__el__p { color: #d3ff8d; }
.bascik__my-comp__x1__el__h2 { font-size: 2rem; }
```

And in the HTML, every `<p>` and `<h2>` inside the component gets the generated class injected:

```html
<p class="bascik__my-comp__x1__el__p">...</p>
```

> **Isolation guarantee:** Element styles only affect elements inside the component. A `p {}` rule in `my-comp.css` will never affect `<p>` tags on the page or in other components.

### @media Support

Media queries work normally. Class names inside them are scoped like any other rule:

```css
@media (max-width: 600px) {
  .logo { font-size: 0.9rem; }
}
```

```css
@media (max-width: 600px) {
  .bascik__comp__x1__logo { font-size: 0.9rem; }
}
```

### @keyframes Scoping

Keyframe names are also prefixed so animations from different components never collide:

```css
@keyframes spin { to { transform: rotate(360deg); } }
.icon { animation: spin 1s linear infinite; }
```

```css
@keyframes bascik__comp__x1__keyframe__spin { to { transform: rotate(360deg); } }
.bascik__comp__x1__icon {
  animation: bascik__comp__x1__keyframe__spin 1s linear infinite;
}
```

### CSS Custom Properties

`--var-name` declarations in a component's CSS are automatically scoped. All `var(--var-name)` references within the same file are updated to match — so custom properties stay isolated to their component.

```css
/* source */
:root {
  --brand: #d3ff8d;
  --size: 1rem;
}
.title {
  color: var(--brand);
  font-size: var(--size);
}
```

```css
/* compiled */
:root {
  --bascik__my-comp__x1__brand: #d3ff8d;
  --bascik__my-comp__x1__size: 1rem;
}
.bascik__my-comp__x1__title {
  color: var(--bascik__my-comp__x1__brand);
  font-size: var(--bascik__my-comp__x1__size);
}
```

> **Only locally-declared properties are scoped.** If a component uses `var(--global-var)` but doesn't declare `--global-var` in its own CSS, that reference is left untouched so it still resolves from a global stylesheet.

### Toggling Scoping

All scoping can be controlled in [`bascik.config.js`](/configuration):

```js
export const bascikConfig = {
  scopeAttribute: {
    class: true, // scope class names
    id: true,    // scope id attributes
    name: true,  // scope name attributes
  },
};
```
