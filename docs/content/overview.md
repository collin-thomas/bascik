# Bascik

> Bascik is a build tool for HTML components. Write your components in plain HTML, CSS, and JavaScript. Bascik scopes and assembles them at build time, outputting plain HTML pages with zero JavaScript added. Supports static site generation (SSG) out of the box.

## What Bascik Does

- Resolves custom HTML tags (`<my-nav></my-nav>`) to their component source HTML at build time.
- Scopes CSS class names, element selectors, `@keyframes`, and CSS custom properties per component so they never collide.
- Rewrites DOM selector calls (`getElementById`, `querySelector`, etc.) in component scripts to match scoped attribute names.
- Wraps component scripts in IIFEs so variables do not leak between components.
- Outputs a `dist/` directory of plain `.html` files with no framework runtime, no client-side JS added by Bascik itself.

## What Bascik Does Not Do

- It is not a JavaScript framework. There is no virtual DOM, no reactive state, no client-side routing.
- It does not add any JavaScript to pages. Every script in the output was written by you.
- It does not require Web Components, Shadow DOM, or any browser-specific API.
