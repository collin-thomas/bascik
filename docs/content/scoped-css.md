# Scoped Styles

Bascik automatically namespaces your component CSS at build time. Paired `.css` files and inline `<style>` tags inside component HTML both go through the same scoping pipeline, so class names, element selectors, `@media` queries, and `@keyframes` stay isolated to the component.

## Where Scoped CSS Can Live

You can define component CSS in either of these places:

- a paired `.css` file next to the component HTML
- an inline `<style>` tag inside the component HTML

Use paired files for most components so the HTML and CSS stay easy to scan. Inline `<style>` tags are still fully supported when keeping a small component in one file is more convenient.

## CSS File Pairing

Scoped styles are defined in a `.css` file with the same name as the component, placed in the same directory:

```text
src/components/
  site-nav/
    site-nav.html
    site-nav.css  ← scoped to site-nav
```

## Class Scoping

Every class name in the `.css` file is prefixed with a unique instance ID. The corresponding HTML attributes are updated to match.

```css
/* site-nav.css - source */
.navigation ul { list-style-type: none; }
.navigation ul li a { padding: 8px; }
```

<!-- compiled-output -->
```css
/* compiled output */
.bascik__site-nav__a1b2c3__navigation ul { list-style-type: none; }
.bascik__site-nav__a1b2c3__navigation ul li a { padding: 8px; }
```

## Element Selector Scoping

Bare element selectors like `p {}` or `h2 {}` are converted to generated class selectors and injected onto matching elements inside the component.

```css
/* my-comp.css - source */
p { color: #d3ff8d; }
h2 { font-size: 2rem; }
```

<!-- compiled-output -->
```css
/* compiled output */
.bascik__my-comp__x1__el__p { color: #d3ff8d; }
.bascik__my-comp__x1__el__h2 { font-size: 2rem; }
```

Every `<p>` and `<h2>` inside the component gets the generated class injected at build time, you never write these class names yourself.

<!-- compiled-output -->
```html
<p class="bascik__my-comp__x1__el__p">...</p>
```

> **Isolation guarantee:** Element styles only affect elements inside the component. A `p {}` rule in `my-comp.css` will never affect `<p>` tags on the page or in other components.

## @media Support

Media queries work normally. Class names inside them are scoped like any other rule:

```css
@media (max-width: 600px) {
  .logo { font-size: 0.9rem; }
}
```

<!-- compiled-output -->
```css
@media (max-width: 600px) {
  .bascik__comp__x1__logo { font-size: 0.9rem; }
}
```

## @keyframes Scoping

Keyframe names are also prefixed so animations from different components never collide:

```css
@keyframes spin { to { transform: rotate(360deg); } }
.icon { animation: spin 1s linear infinite; }
```

<!-- compiled-output -->
```css
@keyframes bascik__comp__x1__keyframe__spin { to { transform: rotate(360deg); } }
.bascik__comp__x1__icon {
  animation: bascik__comp__x1__keyframe__spin 1s linear infinite;
}
```
## CSS ID Selectors

CSS `#id` selectors are converted to scoped class selectors, and the generated class is injected onto the matching element in the HTML. This means `#btn {}` in a component is fully isolated, the same ID name in another component or on the page produces a completely different selector.

```css
/* my-comp.css - source */
#submit-btn { background: #d3ff8d; }
```

<!-- compiled-output -->
```css
/* compiled output */
.bascik__my-comp__id__submit-btn { background: #d3ff8d; }
```

<!-- compiled-output -->
```html
<!-- The matching element gets the generated class injected -->
<button id="bascik__my-comp__a1b2__submit-btn"
        class="bascik__my-comp__id__submit-btn">Submit</button>
```

> **Specificity note:** Converting `#id` to a class drops specificity from `(0,1,0,0)` to `(0,0,1,0)`. `[id]` and `[id="…"]` attribute-selector forms are stripped at compile time, use a class selector instead.
## CSS Custom Properties

`--var-name` declarations in a component's CSS are automatically scoped. All `var(--var-name)` references within the same file are updated to match, so custom properties stay isolated to their component.

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

<!-- compiled-output -->
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

## Toggling Scoping

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

> **MDN reference.** Scoped CSS changes how selectors are rewritten at build time, but the CSS you write is still normal CSS. Use [MDN's CSS reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference) as the primary source for selectors, at-rules, and properties.

## Class Selectors in Component Scripts

Because all instances of the same component share the same scoped class names (for CSS deduplication), `document.querySelector('.myClass')` inside a component script will always return the **first** matching element on the page, not necessarily the element belonging to the current instance. If you have multiple instances of the same component, each instance's script will target the same (first) element.

**The correct pattern** is to use an `id` attribute as your root anchor. `id` attributes are scoped per-instance, so `getElementById` always finds exactly the right element:

```html
<!-- my-comp.html -->
<div id="root" class="wrapper">
  <button id="btn">Click</button>
</div>

<script>
  const root = document.getElementById('root');  // ✓ unique per instance
  const btn  = root.querySelector('button');      // ✓ scoped to this instance
</script>
```

Avoid this anti-pattern:

```html
<div class="wrapper">
  <button class="btn">Click</button>
</div>

<script>
  // ✗ finds the FIRST .wrapper on the page - wrong for instance 2+
  const root = document.querySelector('.wrapper');
</script>
```

By default, all instances of the same component share identical scoped class names so Bascik can emit a single `<style>` block per component, regardless of how many times it appears on the page. If you genuinely need class selectors to be unique per instance (for example, to use `querySelector` safely across multiple instances), set `deduplicateCss: false`:

```js
export const bascikConfig = {
  deduplicateCss: false, // each instance gets its own unique class names
};
```

With `deduplicateCss: false`, class selectors behave like `id` selectors, scoped per instance, but Bascik emits a separate `<style>` block for every component instance. Use the `id`-based pattern above instead whenever possible; it works with the default settings and avoids extra style blocks.

## Live Demo

The `feature-card` component used throughout these docs illustrates scoped styles end-to-end. Source files and compiled output are shown below.

**Source HTML** (`feature-card.html`):

<!-- demo:source-usage -->
```html
<feature-card
  data-bascik-prop-label="Scoped"
  data-bascik-prop-title="Isolated Styles"
  data-bascik-prop-desc="Hover to see scoped transitions.">
</feature-card>
```

<!-- demo:source-html -->
```html
<div class="fcard">
  <p class="fcard-label" data-bascik-prop-label></p>
  <h3 class="fcard-title" data-bascik-prop-title></h3>
  <p class="fcard-desc" data-bascik-prop-desc></p>
  <div class="fcard-slot">
    <div data-bascik-slot></div>
  </div>
</div>
```

**Source CSS** (`feature-card.css`):

<!-- demo:source-css -->
```css
.fcard {
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 24px;
  transition: border-color .2s, transform .2s, box-shadow .2s;
}

.fcard:hover {
  border-color: var(--border-hover);
  box-shadow: 0 0 0 1px var(--accent-dim), 0 8px 32px rgba(0,0,0,0.3);
  transform: translateY(-2px);
}

.fcard-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .1em;
  color: var(--accent);
  margin-bottom: 8px;
}

.fcard-title {
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--text);
}

.fcard-desc {
  font-size: 0.88rem;
  color: var(--text-muted);
  margin-bottom: 0;
}

.fcard-slot {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.fcard-slot:empty {
  display: none;
}
```

**Compiled output HTML** (class names scoped, props injected, slot wrappers removed):

<!-- demo:output-html -->
```html
<div class="bascik__feature-card__fcard">
  <p class="bascik__feature-card__fcard-label">Scoped</p>
  <h3 class="bascik__feature-card__fcard-title">Isolated Styles</h3>
  <p class="bascik__feature-card__fcard-desc">
    Hover over me to see transitions and shadows that won't leak out.
  </p>
</div>
```

**Compiled output CSS** (all class selectors prefixed with the component scope):

<!-- demo:output-css -->
```css
.bascik__feature-card__fcard {
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: var(--r);
  padding: 24px;
  transition: border-color .2s, transform .2s, box-shadow .2s;
}

.bascik__feature-card__fcard:hover {
  border-color: var(--border-hover);
  box-shadow: 0 0 0 1px var(--accent-dim), 0 8px 32px rgba(0,0,0,0.3);
  transform: translateY(-2px);
}

.bascik__feature-card__fcard-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .1em;
  color: var(--accent);
  margin-bottom: 8px;
}

.bascik__feature-card__fcard-title {
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--text);
}

.bascik__feature-card__fcard-desc {
  font-size: 0.88rem;
  color: var(--text-muted);
  margin-bottom: 0;
}

.bascik__feature-card__fcard-slot {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.bascik__feature-card__fcard-slot:empty {
  display: none;
}
```
