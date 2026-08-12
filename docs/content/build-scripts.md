# Build-time Scripts

Build-time scripts let you run Node.js code at transpile time and inject the output directly into the page with no client-side JavaScript required. Use them to pull in Markdown files, generate navigation from JSON, or fetch remote data at build time.

## data-bascik-build

Tag any `<script>` block with `data-bascik-build` and Bascik will execute it as a Node.js ESM module during transpilation. The script's `stdout` output replaces the tag in the final HTML.

```html
<script data-bascik-build>
  console.log('<p>This text was generated at build time.</p>');
</script>
```

Output in the compiled HTML:

```html
<p>This text was generated at build time.</p>
```

> **A few rules to know:** Top-level `import` and `await` are supported. Paths are relative to the project root (where you run `bascik`). Write output with `console.log()`. Runs during both dev and production builds. Component tags in the output are resolved normally, so your build script can emit `<my-card>` and it will be transpiled.

## Error Handling

If a build script throws, Bascik logs a warning and replaces the script tag with an empty string. The build continues rather than aborting. Check your terminal output if content is missing from the page.

## Example: Reading a Markdown File

A common pattern is converting Markdown content to HTML at build time:

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import { marked } from 'marked';

  const md = await readFile('./content/intro.md', 'utf8');
  console.log(marked(md));
</script>
```

## Example: Generating a Nav from JSON

Read a JSON data file and render HTML markup from it:

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';

  const items = JSON.parse(await readFile('./content/nav.json', 'utf8'));
  const links = items.map(item =>
    `<li><a href="${item.href}">${item.label}</a></li>`
  ).join('\n');
  console.log(`<ul>\n${links}\n</ul>`);
</script>
```

## Example: Fetching at Build Time

Node.js 24+ includes a global `fetch`. Use it to pull remote data at build time so the result is baked into the page:

```html
<script data-bascik-build>
  const res = await fetch('https://api.example.com/posts/latest');
  const { title, excerpt } = await res.json();
  console.log(`<h2>${title}</h2><p>${excerpt}</p>`);
</script>
```

## Head Components

Components work inside `<head>` as well as `<body>`. This lets you extract repeated meta tags, link tags, or any other head content into a reusable component:

```html
<!-- src/components/site-meta.html -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="description" content="My site description" />
<link rel="icon" href="/favicon.ico" />
```

```html
<!-- src/pages/index.html -->
<head>
  <title>Home</title>
  <site-meta></site-meta>
</head>
```

Bascik resolves the component tag the same way it does in body content, the component HTML is substituted in place. CSS scoping and prop injection work normally.

## When to Use Build Scripts

Build scripts are the right tool when:

- Content lives in a file or API outside the HTML source (Markdown, JSON, CSV, remote endpoints).
- You need to repeat the same transformation across multiple pages without copy-pasting logic.
- Generated markup should be part of the static HTML output rather than rendered on the client.

Prefer plain hardcoded HTML when the content is short, stable, and doesn't come from an external source.

## npm Packages

A Bascik project is a Node.js project, any npm package can be installed and used in build scripts. Install it once and import it anywhere:

```sh
npm install gray-matter
```

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import matter from 'gray-matter';

  const raw = await readFile('./content/post.md', 'utf8');
  const { data, content } = matter(raw);
  console.log(`
    <article>
      <h1>${data.title}</h1>
      <p class="date">${data.date}</p>
    </article>
  `);
</script>
```

## Shared Scripts

Build scripts are just ESM modules. You can write utility functions in your project and import them across pages with no special Bascik API required:

```js
// scripts/render-cards.js
import { readFile } from 'node:fs/promises';

export async function renderCards(jsonPath) {
  const items = JSON.parse(await readFile(jsonPath, 'utf8'));
  return items.map(item => `
    <div class="card">
      <h3>${item.title}</h3>
      <p>${item.description}</p>
    </div>
  `).join('\n');
}
```

```html
<script data-bascik-build>
  import { join } from 'node:path';
  import { pathToFileURL } from 'node:url';
  import { renderCards } from pathToFileURL(join(process.cwd(), 'scripts/render-cards.js')).href;

  console.log(await renderCards('./content/team.json'));
</script>
```

> **Import paths in build scripts:** Node.js requires absolute paths when importing local modules from a dynamically executed script. Use `pathToFileURL(join(process.cwd(), 'path/to/your-script.js')).href` to import your own modules reliably from any build script.

## Environment Variables

Environment variables set in your shell or a `.env` file (loaded with a tool like [dotenv](https://github.com/motdotla/dotenv)) are available via `process.env`. Use this for API keys, deployment URLs, or feature flags that should be baked into the build without shipping to the browser:

```html
<script data-bascik-build>
  const apiUrl = process.env.API_URL ?? 'https://api.example.com';
  console.log(`<meta name="api-url" content="${apiUrl}" />`);
</script>
```

## Limitations

- **No streaming:** the full stdout of the script is collected before injection. You cannot stream HTML into the page incrementally.
- **No HMR awareness:** in dev mode Bascik watches source files. If a build script reads an external file, changes to that file won't automatically re-trigger the script. Restart the dev server to re-run.
- **ESM only:** scripts are written as `.mjs` files. Use `import` syntax; `require()` is not available.
- **Node.js only:** browser globals like `window` and `document` are not available in build scripts.

For per-request server-side rendering, see [Server scripts](/server).

<!-- demo:code -->
```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import { marked } from 'marked';
  const md = await readFile('./content/overview.md', 'utf8');
  const firstPara = md.split('\n\n')[1];
  console.log(`
    <feature-card
      data-bascik-prop-label="Build Time"
      data-bascik-prop-title="Generated from Markdown"
      data-bascik-prop-desc="${marked.parseInline(firstPara)}">
    </feature-card>
  `);
</script>
```

<!-- demo:output -->
```html
<!-- The script is replaced by its stdout output -->
<div class="bascik__feature-card__fcard">
  <p class="bascik__feature-card__fcard-label">Build Time</p>
  <h3 class="bascik__feature-card__fcard-title">Generated from Markdown</h3>
  <p class="bascik__feature-card__fcard-desc">Bascik is a build tool for HTML components...</p>
</div>
```
