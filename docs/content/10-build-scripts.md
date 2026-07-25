## Build-time Scripts

### data-bascik-build

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

### Execution Model

Each `data-bascik-build` script is written to a temporary `.mjs` file and executed using the same Node.js binary running Bascik. The rules are:

- Top-level `import` and top-level `await` are supported.
- The working directory is the **project root** — paths in `readFile` or `fetch` are relative to where you run `bascik`.
- Write output with `console.log()` or `process.stdout.write()`.
- Anything written to `stderr` is forwarded to Bascik's own stderr.
- The script runs during both `bascik` (dev) and `bascik --build` (production).

> **Component tags in output:** Build script output is processed before component resolution, so your generated HTML can include component tags like `<my-card>` — they will be transpiled normally.

### Error Handling

If a build script throws, Bascik logs a warning and replaces the script tag with an empty string. The build continues rather than aborting. Check your terminal output if content is missing from the page.

### Example: Reading a Markdown File

A common pattern is converting Markdown content to HTML at build time:

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import { marked } from 'marked';

  const md = await readFile('./content/intro.md', 'utf8');
  console.log(marked(md));
</script>
```

### Example: Generating a Nav from JSON

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

### Example: Fetching at Build Time

Node.js 24+ includes a global `fetch`. Use it to pull remote data at build time so the result is baked into the page:

```html
<script data-bascik-build>
  const res = await fetch('https://api.example.com/posts/latest');
  const { title, excerpt } = await res.json();
  console.log(`<h2>${title}</h2><p>${excerpt}</p>`);
</script>
```

### data-bascik-dev

Tag a script with `data-bascik-dev` to mark it as a dev-only script. In development the attribute is stripped and the script runs normally in the browser. In production builds (`bascik --build`) the entire script tag is removed from the output.

```html
<script data-bascik-dev>
  console.log('Component mounted — dev only');
</script>
```

This is useful for debug logging, development overlays, or any browser script that should never ship to production.

> **dev vs. build:** `data-bascik-build` scripts execute at transpile time and inject HTML. `data-bascik-dev` scripts run in the browser, but only in dev mode.

### Head Components

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

Bascik resolves the component tag the same way it does in body content — the component HTML is substituted in place. CSS scoping and prop injection work normally.

### When to Use Build Scripts

Build scripts are the right tool when:

- Content lives in a file or API outside the HTML source (Markdown, JSON, CSV, remote endpoints).
- You need to repeat the same transformation across multiple pages without copy-pasting logic.
- Generated markup should be part of the static HTML output rather than rendered on the client.

Prefer plain hardcoded HTML when:

- The content is short, stable, and doesn't come from an external source.
- The overhead of reading a file or network call at build time isn't justified.

### The npm Ecosystem

Because a Bascik project is a Node.js project, any npm package can be installed and imported in build scripts. Write your own shared utility modules in `src/lib/` and import them across pages. Access `process.env` for environment variables and API keys that should be baked into the build without shipping to the browser.

