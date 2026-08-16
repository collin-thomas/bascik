# Components

Components are the core building block in Bascik. Each component is a `.html` file in `src/components/`. The file name becomes the tag name used in your pages and in other components.

## HTML-Only Components

The simplest component is just markup. No CSS, no JavaScript required.

<!-- demo:source-usage-hello -->
```html
<hello-card></hello-card>
```

<!-- demo:source-html-hello -->
```html
<article class="hello-card">
  <p class="hello-card-kicker">One file. One tag.</p>
  <h3 class="hello-card-title">Plain HTML, ready to reuse.</h3>
  <p class="hello-card-body">Bascik replaces the custom tag at build time and ships the finished markup.</p>
</article>
```

> **Styles omitted for clarity.** This demo component includes a companion `.css` file that styles the card. The CSS is not shown in the source view so the demo stays focused on the HTML structure.

<!-- demo:output-html-hello -->
```html
<article class="bascik__hello-card__hello-card">
  <p class="bascik__hello-card__hello-card-kicker">One file. One tag.</p>
  <h3 class="bascik__hello-card__hello-card-title">Plain HTML, ready to reuse.</h3>
  <p class="bascik__hello-card__hello-card-body">Bascik replaces the custom tag at build time and ships the finished markup.</p>
</article>
```

<!-- demo:output-css-hello -->
```css
.bascik__hello-card__hello-card { ... }
.bascik__hello-card__hello-card-kicker { ... }
.bascik__hello-card__hello-card-title { ... }
.bascik__hello-card__hello-card-body { ... }
```

Components can appear in other components too. If `site-layout.html` uses `<page-footer></page-footer>`, every page that uses `<site-layout>` gets the footer automatically.

## HTML with CSS

Add a `<style>` block to style the component inline. Bascik scopes the CSS to the component at build time so selectors from one component never affect another.

<!-- demo:source-usage-badge -->
```html
<comp-badge></comp-badge>
```

<!-- demo:source-html-badge -->
```html
<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: #d1fae5;
    color: #065f46;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 600;
  }
  .badge-dot {
    width: 6px;
    height: 6px;
    background: #10b981;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
<span class="badge">
  <span class="badge-dot"></span>
  All systems operational
</span>
```

<!-- demo:output-html-badge -->
```html
<span class="bascik__comp-badge__badge">
  <span class="bascik__comp-badge__badge-dot"></span>
  All systems operational
</span>
```

<!-- demo:output-css-badge -->
```css
.bascik__comp-badge__badge { ... }
.bascik__comp-badge__badge-dot { ... }
```

> **More on the next page.** [Scoped Styles](/scoped-styles) covers exactly how class names and selectors are namespaced and what CSS patterns are supported.

## HTML with JavaScript

Add a `<script>` block for interactive behavior. Use `id` on any element you need to target from JS and reach it with `getElementById`.

<!-- demo:source-usage-toggle -->
```html
<comp-toggle></comp-toggle>
```

<!-- demo:source-html-toggle -->
```html
<div class="toggle-wrap">
  <p>Bascik assembles components at build time and ships plain HTML files with no framework runtime.</p>
  <div id="detail" hidden>
    <p>No JavaScript is added to the page. Every script in the output was written by you.</p>
  </div>
  <button id="btn" type="button">Read more</button>
</div>
```

<!-- demo:source-js-toggle -->
```js
const btn = document.getElementById('btn');
const detail = document.getElementById('detail');
btn.addEventListener('click', () => {
  detail.hidden = !detail.hidden;
  btn.textContent = detail.hidden ? 'Read more' : 'Show less';
});
```

> **Styles omitted for clarity.** This demo component includes a companion `.css` file that styles the card. The CSS is not shown in the source view so the demo stays focused on the JavaScript.

<!-- demo:output-html-toggle -->
```html
<div class="bascik__comp-toggle__toggle-wrap">
  <p class="bascik__comp-toggle__el__p">Bascik assembles components at build time and ships plain HTML files with no framework runtime.</p>
  <div id="bascik__comp-toggle__a1b__detail" hidden>
    <p class="bascik__comp-toggle__el__p">No JavaScript is added to the page. Every script in the output was written by you.</p>
  </div>
  <button class="bascik__comp-toggle__el__button" id="bascik__comp-toggle__a1b__btn" type="button">Read more</button>
</div>
<script>
  (function(){
  const btn = document.getElementById('bascik__comp-toggle__a1b__btn');
  const detail = document.getElementById('bascik__comp-toggle__a1b__detail');
  btn.addEventListener('click', () => {
    detail.hidden = !detail.hidden;
    btn.textContent = detail.hidden ? 'Read more' : 'Show less';
  });
  })();
</script>
```

<!-- demo:output-css-toggle -->
```css
.bascik__comp-toggle__toggle-wrap { ... }
.bascik__comp-toggle__toggle-wrap .bascik__comp-toggle__el__p { ... }
.bascik__comp-toggle__toggle-wrap .bascik__comp-toggle__el__button { ... }
```

> **See also.** [Scoped JavaScript](/scoped-javascript) explains how Bascik rewrites selectors so multiple instances of the same component on the same page stay fully independent.

## HTML, CSS, and JavaScript Together

All three can live in a single file. A `<style>` block, the markup, and a `<script>` block in any order; Bascik handles all of them.

<!-- demo:source-usage-alert -->
```html
<comp-alert></comp-alert>
```

<!-- demo:source-html-alert -->
```html
<style>
  .alert {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid #f59e0b;
    border-radius: 8px;
    background: #fffbeb;
  }
  .alert-body {
    flex: 1;
    margin: 0;
    font-size: 0.9rem;
    color: #92400e;
  }
  .alert-close {
    background: none;
    border: none;
    cursor: pointer;
    color: #b45309;
    font-size: 1.2rem;
    line-height: 1;
    padding: 0;
  }
</style>
<div class="alert" id="alert">
  <p class="alert-body">Scheduled maintenance Sunday, 2am–4am UTC.</p>
  <button id="close" class="alert-close" aria-label="Dismiss">×</button>
</div>
<script>
  document.getElementById('close').addEventListener('click', () => {
    document.getElementById('alert').hidden = true;
  });
</script>
```

<!-- demo:output-html-alert -->
```html
<div class="bascik__comp-alert__alert" id="bascik__comp-alert__a1b__alert">
  <p class="bascik__comp-alert__alert-body">Scheduled maintenance Sunday, 2am–4am UTC.</p>
  <button id="bascik__comp-alert__a1b__close" class="bascik__comp-alert__alert-close" aria-label="Dismiss">×</button>
</div>
<script>
  (function(){
  document.getElementById('bascik__comp-alert__a1b__close').addEventListener('click', () => {
    document.getElementById('bascik__comp-alert__a1b__alert').hidden = true;
  });
  })();
</script>
```

<!-- demo:output-css-alert -->
```css
.bascik__comp-alert__alert { ... }
.bascik__comp-alert__alert-body { ... }
.bascik__comp-alert__alert-close { ... }
```

## Separate CSS Files

As a component grows, moving the CSS into its own file keeps things readable. Create a `.css` file with the same base name alongside the `.html` file. Both approaches are fully equivalent; Bascik applies the same scoping either way.

<!-- demo:source-usage-card -->
```html
<feature-card
  data-bascik-prop-title="Build-time Components"
  data-bascik-prop-desc="Bascik resolves tags and ships plain HTML.">
</feature-card>
```

<!-- demo:source-html-card -->
```html
<div class="fcard">
  <h3 data-bascik-prop-title></h3>
  <p data-bascik-prop-desc></p>
</div>
```

<!-- demo:source-css-card -->
```css
.fcard {
  padding: 24px;
  background: #242628;
  border: 1px solid #3a3d40;
  border-radius: 10px;

  h3 { color: #f0f1f2; }
  p  { font-size: 0.875rem; color: #8d929e; }

  &:hover {
    border-color: rgba(211,255,141,0.35);
    box-shadow: 0 0 0 1px rgba(211,255,141,0.12);
  }
}
```

<!-- demo:output-html-card -->
```html
<div class="bascik__feature-card__fcard">
  <h3>Build-time Components</h3>
  <p>Bascik resolves tags and ships plain HTML.</p>
</div>
```

<!-- demo:output-css-card -->
```css
.bascik__feature-card__fcard { ... }
.bascik__feature-card__fcard h3 { ... }
.bascik__feature-card__fcard p { ... }
.bascik__feature-card__fcard:hover { ... }
```

## Subfolder Layout

For components with multiple files, a subfolder keeps things tidy. Name the subfolder and the files inside it the same:

```text
src/components/
  feature-card/
    feature-card.html
    feature-card.css
```

Bascik derives the tag name from the `.html` filename, not the folder. `feature-card/feature-card.html` still produces `<feature-card>`.

> **No restart needed.** The dev server watches `src/components/` for new and changed files. Drop in a new `.html` or `.css` file and all affected pages re-transpile and reload automatically.
