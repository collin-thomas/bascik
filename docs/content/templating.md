# Templating Recipes

Bascik does not ship a template language or a custom server-side object model. The core stays small: static HTML, scoped CSS, and plain Node.js scripts at build time or request time. If you want loops, partials, or layout composition, use an existing template library or a tiny project helper file.

This page shows the patterns Bascik recommends: explicit recipes, not framework magic.

## Why Bascik stays out of the template layer

The goal is to keep the runtime boring and predictable.

- Bascik compiles HTML and CSS, not a second app framework
- `data-bascik-server` runs plain Node.js ESM with `process.env.BASCIK_REQUEST`
- rendering helpers stay in your app code where they belong
- escaping and HTML composition remain explicit, not hidden behind globals

If a project needs a template engine, use one that already solves the problem well. Bascik is the static-site engine; the template library is an app choice.

## Recipe 1: plain JS template literals

For many pages, the simplest approach is still ordinary JavaScript string templates.

```html
<script data-bascik-server>
  const { headers } = JSON.parse(process.env.BASCIK_REQUEST);
  const user = String(headers['x-display-name'] ?? 'Guest')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  console.log(`
    <section class="welcome">
      <h2>Hello, ${user}</h2>
      <ul>
        <li>Overview</li>
        <li>Reports</li>
        <li>Settings</li>
      </ul>
    </section>
  `);
</script>
```

This is often enough for dashboards, landing pages, and one-off server-rendered sections. It is explicit, familiar, and easy to reason about.

## Recipe 2: a tiny shared HTML helper

When the same escaping or list-rendering logic appears repeatedly, keep it in a small helper module and import it.

```js
// lib/html.mjs
export const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export const renderList = (items) =>
  `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
```

```html
<script data-bascik-server>
  import { escapeHtml, renderList } from './lib/html.mjs';

  const { searchParams } = JSON.parse(process.env.BASCIK_REQUEST);
  const items = (searchParams.tags ?? 'news,updates').split(',');
  const safeTags = items.map(v => escapeHtml(v.trim())).filter(Boolean);

  console.log(`
    <section>
      <h2>Topics</h2>
      ${renderList(safeTags)}
    </section>
  `);
</script>
```

This is the same philosophy as the server-script rule: keep the runtime small, but let your app own the reusable helpers it wants.

## Recipe 3: EJS for loops and includes

If the project needs more structure, use a template library like EJS for layout fragments and repeated markup.

```sh
npm install ejs
```

```html
<script data-bascik-server>
  import { readFile } from 'node:fs/promises';
  import ejs from 'ejs';

  const rows = [
    { title: 'First post', href: '/posts/first' },
    { title: 'Second post', href: '/posts/second' },
  ];

  const template = await readFile('./templates/post-list.ejs', 'utf8');
  console.log(ejs.render(template, { rows }));
</script>
```

```ejs
<!-- templates/post-list.ejs -->
<ul class="post-list">
  <% rows.forEach((row) => { %>
    <li><a href="<%= row.href %>"><%= row.title %></a></li>
  <% }); %>
</ul>
```

This works well when the HTML is large, repetitive, or needs layout-like partials. Bascik still stays out of the way because the template engine is just a dependency in the app layer.

## Recipe 4: Nunjucks for richer template composition

Nunjucks is a good fit for pages that want includes, layout blocks, and more opinionated template syntax without turning Bascik into a framework.

```sh
npm install nunjucks
```

```html
<script data-bascik-server>
  import nunjucks from 'nunjucks';

  const html = nunjucks.render('./templates/page.njk', {
    title: 'Projects',
    items: ['Alpha', 'Bravo', 'Charlie'],
  });

  console.log(html);
</script>
```

```njk
{# templates/page.njk #}
<section>
  <h2>{{ title }}</h2>
  <ul>
    {% for item in items %}
      <li>{{ item }}</li>
    {% endfor %}
  </ul>
</section>
```

Nunjucks is useful when the site has a lot of repetitive HTML and a real template structure. Bascik still remains the static compiler; the template library just renders fragments into ordinary HTML before they are injected.

## Recipe 5: Handlebars

Handlebars is a good choice when the team prefers a logic-less template syntax and wants helpers registered separately from template files.

```sh
npm install handlebars
```

```html
<script data-bascik-server>
  import { readFile } from 'node:fs/promises';
  import Handlebars from 'handlebars';

  const { searchParams } = JSON.parse(process.env.BASCIK_REQUEST);
  const page = Math.max(1, Number(searchParams.page ?? 1));

  const src = await readFile('./templates/article-list.hbs', 'utf8');
  const template = Handlebars.compile(src);

  const items = [
    { title: 'First article', href: '/posts/first' },
    { title: 'Second article', href: '/posts/second' },
  ];

  console.log(template({ items, page }));
</script>
```

```hbs
{{! templates/article-list.hbs }}
<section>
  <h2>Articles — page {{page}}</h2>
  <ul>
    {{#each items}}
      <li><a href="{{href}}">{{title}}</a></li>
    {{/each}}
  </ul>
</section>
```

Handlebars HTML-escapes `{{value}}` expressions by default. Use the triple-stache `{{{value}}}` only when you have already sanitized the value yourself.

## Keep the boundary explicit

The best rule is simple:

- do not add a template language to the core
- do not add a custom request/session/cookie object to the runtime
- do not hide escaping or HTML assembly behind globals
- do document recipes for the common patterns people actually reach for

If a project wants a template language, it should be an explicit dependency and an explicit choice. That keeps Bascik focused on the job it actually does best: compiling static HTML, CSS, and JS without becoming a framework.
