# Bascik

> Bascik is a build tool for HTML components. Write your components in plain HTML, CSS, and JavaScript. Bascik scopes and assembles them at build time, outputting plain HTML pages with zero JavaScript added. Supports static site generation (SSG) out of the box.

## What Bascik Does

- Resolves custom HTML tags (`<my-nav></my-nav>`) to their component source HTML at build time.
- Scopes CSS class names, element selectors, `@keyframes`, and CSS custom properties per component so they never collide.
- Rewrites DOM selector calls (`getElementById`, `querySelector`, etc.) in component scripts to match scoped attribute names.
- Wraps component scripts in IIFEs so variables do not leak between components.
- Outputs a `dist/` directory of plain `.html` files with no framework runtime, no client-side JS added by Bascik itself.
- Supports TypeScript natively — `bascik.config.ts`, build scripts, and helper modules run on Node 24 with no compiler step.

## What Bascik Does Not Do

- It is not a JavaScript framework. There is no virtual DOM, no reactive state, no client-side routing.
- It does not add any JavaScript to pages. Every script in the output was written by you.
- It does not require Web Components, Shadow DOM, or any browser-specific API.

## Example: One Component, Start to Finish

Create a file. The file name is the tag name. HTML, CSS, and JavaScript live together in that one file, and everything gets scoped automatically at build time.

<!-- demo:home-card-component -->
```html
<!-- src/components/my-card.html -->
<style>
  .card {
    padding: 24px 28px;
    border: 1px solid #3a3d40;
    border-top: 3px solid #d3ff8d;
    border-radius: 10px;
  }
</style>
<article class="card">
  <div data-bascik-slot></div>
</article>
```

Reference the tag in any page. No imports, no registration, no configuration.

<!-- demo:home-card-usage -->
```html
<!-- src/pages/index.html -->
<my-card>
  <h3>My Card</h3>
  <p>Any HTML goes inside as slot content.</p>
</my-card>
```

At build time Bascik inlines the component and scopes every class name and DOM selector:

<!-- demo:home-card-output -->
```html
<!-- dist/index.html -->
<style>
  .bascik__my-card__card {
    padding: 24px 28px;
    border: 1px solid #3a3d40;
    border-top: 3px solid #d3ff8d;
    border-radius: 10px;
  }
</style>
<article class="bascik__my-card__card">
  <h3>My Card</h3>
  <p>Any HTML goes inside as slot content.</p>
</article>
```

## Example: Two Isolated Instances

The same component used twice on one page. Each instance gets its own namespace, so plain `getElementById` and `querySelector` calls stay fully isolated without runtime JS, Shadow DOM, or a virtual DOM.

<!-- demo:home-counter-html -->
```html
<!-- src/components/demo-counter.html - component template -->
<div class="ctr">
  <span class="ctr-label" data-bascik-prop-label></span>
  <span class="ctr-count" id="count">0</span>
  <div class="ctr-btns">
    <button class="ctr-dec">−</button>
    <button class="ctr-inc">+</button>
  </div>
</div>

<!-- src/pages/index.html - usage -->
<demo-counter data-bascik-prop-label="Instance A"></demo-counter>
<demo-counter data-bascik-prop-label="Instance B"></demo-counter>
```

<!-- demo:home-counter-css -->
```css
/* Auto-scoped - class names become:
   .bascik__demo-counter__ctr { ... } */
.ctr {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.ctr-count {
  font-size: 2.4rem;
  font-weight: 700;
  color: #d3ff8d;
}
.ctr-dec, .ctr-inc {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  cursor: pointer;
}
```

<!-- demo:home-counter-js -->
```js
// Plain JavaScript. No framework APIs, no special
// syntax. Bascik scopes the selectors at build time
// so each instance stays fully isolated.
const count = document.getElementById('count');
const dec = document.querySelector('.ctr-dec');
const inc = document.querySelector('.ctr-inc');
let n = 0;
dec.addEventListener('click', () => {
  n--; count.textContent = n;
});
inc.addEventListener('click', () => {
  n++; count.textContent = n;
});
```
