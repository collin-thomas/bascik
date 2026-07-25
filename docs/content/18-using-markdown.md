## Using Markdown

Bascik does not include a Markdown pipeline — but `data-bascik-build` scripts are Node.js, which means you can install any Markdown library and use it directly. This is the same approach used to build the page you are reading right now.

### marked

[marked](https://marked.js.org) is a fast, zero-dependency Markdown parser. Install it once and import it in any build script.

```sh
npm install marked
```

Read a Markdown file and output the HTML:

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import { marked } from 'marked';

  const md = await readFile('./content/intro.md', 'utf8');
  console.log(marked(md));
</script>
```

The output replaces the script tag in the compiled HTML — no client-side JavaScript runs.

### Front Matter with gray-matter

Most content workflows attach metadata (title, date, author, tags) to Markdown files using YAML front matter. [gray-matter](https://github.com/jonschlinkert/gray-matter) parses it out cleanly.

```sh
npm install gray-matter marked
```

```md
---
title: My First Post
date: 2025-01-15
tags: [css, performance]
---

This is the post body.
```

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import { marked } from 'marked';
  import matter from 'gray-matter';

  const raw = await readFile('./content/post.md', 'utf8');
  const { data, content } = matter(raw);

  console.log(`
    <article>
      <h1>${data.title}</h1>
      <time datetime="${data.date}">${new Date(data.date).toLocaleDateString('en-US', { dateStyle: 'long' })}</time>
      ${marked(content)}
    </article>
  `);
</script>
```

### Building a Content Collection

Read an entire folder of Markdown files and generate a list or index page:

```html
<script data-bascik-build>
  import { readdir, readFile } from 'node:fs/promises';
  import matter from 'gray-matter';

  const files = (await readdir('./content/posts'))
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse(); // newest first if files are date-prefixed

  const posts = await Promise.all(files.map(async file => {
    const raw = await readFile(`./content/posts/${file}`, 'utf8');
    const { data } = matter(raw);
    const slug = file.replace(/\.md$/, '');
    return { slug, ...data };
  }));

  const items = posts.map(p => `
    <li>
      <a href="/posts/${p.slug}">${p.title}</a>
      <time>${p.date}</time>
    </li>
  `).join('\n');

  console.log(`<ul class="post-list">\n${items}\n</ul>`);
</script>
```

> **Tip.** Each post's HTML can live on its own page too. Create `src/pages/posts/[slug].html` as a template, or use a build script to generate static output files programmatically.

### markdown-it

[markdown-it](https://markdown-it.github.io) is an alternative parser with a rich plugin ecosystem — syntax highlighting, footnotes, custom containers, and more.

```sh
npm install markdown-it
```

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import MarkdownIt from 'markdown-it';

  const md = new MarkdownIt({ html: true, typographer: true });
  const source = await readFile('./content/article.md', 'utf8');
  console.log(md.render(source));
</script>
```

Add a plugin for syntax highlighting with [highlight.js](https://highlightjs.org):

```sh
npm install markdown-it highlight.js
```

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import MarkdownIt from 'markdown-it';
  import hljs from 'highlight.js';

  const md = new MarkdownIt({
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return '';
    }
  });

  const source = await readFile('./content/article.md', 'utf8');
  console.log(md.render(source));
</script>
```

Then include the highlight.js stylesheet in your page `<head>`:

```html
<link rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css" />
```

### remark / unified

The [unified](https://unifiedjs.com) ecosystem provides an AST-based pipeline. It is more involved to set up but gives precise control over parsing, transforming, and serializing Markdown.

```sh
npm install unified remark-parse remark-html
```

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import { unified } from 'unified';
  import remarkParse from 'remark-parse';
  import remarkHtml from 'remark-html';

  const md = await readFile('./content/article.md', 'utf8');
  const file = await unified()
    .use(remarkParse)
    .use(remarkHtml)
    .process(md);

  console.log(String(file));
</script>
```

The unified plugin system lets you add transformations like automatic heading IDs, GFM tables, and math rendering using `remark-*` packages.

### CMS-Sourced Markdown

If your content comes from a headless CMS that returns Markdown via an API, fetch it at build time:

```html
<script data-bascik-build>
  import { marked } from 'marked';

  const res = await fetch('https://your-cms.example.com/api/page/home', {
    headers: { Authorization: `Bearer ${process.env.CMS_TOKEN}` }
  });
  const { body } = await res.json();
  console.log(marked(body));
</script>
```

The Markdown is converted to HTML and baked into the static output. No CMS API calls happen in the browser — users see plain HTML.
