# Getting Started with Bascik

Bascik is a build-time static site generator that lets you write **reusable HTML components** with scoped CSS and scoped JavaScript — no framework required.

## Why Static HTML?

Static HTML files load instantly, rank well in search engines, and require no server-side runtime. With Bascik you get the developer experience of reusable components without shipping any framework to the browser.

## Your First Component

Create a file at `src/components/my-card.html`:

```html
<div class="card">
  <h2 class="card-title" data-bascik-prop-title></h2>
  <p data-bascik-prop-desc></p>
</div>
```

Then use it in any page:

```html
<my-card
  data-bascik-prop-title="Hello World"
  data-bascik-prop-desc="Assembled at build time, zero JS shipped."
></my-card>
```

## Scoped Styles, Zero Conflicts

Pair a CSS file alongside the component and Bascik automatically scopes every class name, element selector, and custom property — even if you reuse the same names across different components.

## Build-time Data

Use `<script data-bascik-build>` to pull in external data — Markdown posts, JSON, API responses — at build time. The script runs in Node.js and its stdout is injected directly into the page. **No client-side JavaScript required.**

## Learn More

Read the [Bascik documentation](https://bascik.dev) for a full reference on components, slots, props, scoped styles, and build-time scripts.
