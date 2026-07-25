# Bascik Docs — Copilot Instructions

This file applies to all work inside `/docs/`. Read it before creating or editing docs pages.

## Content Lives in Markdown

**All docs page content must be written in `docs/content/*.md` files, not directly in the HTML page.**

The Markdown files serve three purposes simultaneously:
1. They are the canonical source for the rendered docs page (via `data-bascik-build`)
2. They feed `llms.txt` (via `docs/scripts/generate-llms-txt.mjs`)
3. They feed `SKILL.md` (the Copilot skill file at `docs/src/pages/assets/SKILL.md`, served at `/assets/SKILL.md`)

**When adding or updating docs content:**
- Write the prose and code examples in the appropriate `docs/content/NN-topic.md` file
- Number new files sequentially (`16-`, `17-`, …)
- The HTML page is a shell — edit it only for page-specific chrome (custom styles, decorative UI, score grids, etc.)
- Never duplicate prose between the MD file and the HTML file

## How Pages Render from MD

Each docs page that has a corresponding MD file uses a `<script data-bascik-build>` block inside `<main class="docs-content">`:

```html
<!-- Content rendered from docs/content/NN-topic.md at build time.
     To update page content, edit the MD file — not this file. -->
<script data-bascik-build>
  import { join } from 'node:path';
  import { pathToFileURL } from 'node:url';
  const { renderMd } = await import(
    pathToFileURL(join(process.cwd(), 'scripts/md-renderer.mjs')).href
  );
  console.log(await renderMd('./content/NN-topic.md', { skipFirstHeading: true }));
</script>
```

The `renderMd` helper (`docs/scripts/md-renderer.mjs`) applies these transformations:
- Fenced code blocks (` ``` `) → `<code-block data-bascik-prop-lang="…">` component
- Blockquotes (`>`) → `<div class="callout">`

The `skipFirstHeading: true` option strips the leading `## Section Name` heading that each MD file starts with (needed for llms.txt consistency) since the HTML shell already provides the `<h1>`.

## HTML Page Shell Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- title, styles.css, any page-specific <style> -->
</head>
<body>
  <docs-nav></docs-nav>
  <div class="container">
    <div class="docs-layout">
      <docs-sidebar></docs-sidebar>
      <main class="docs-content">
        <p class="section-label">Category</p>
        <h1>Page Title</h1>
        <p class="page-intro">One or two sentence intro.</p>

        <!-- Any page-specific decorative UI (score grids, etc.) -->

        <!-- MD-driven content block -->
        <script data-bascik-build>…</script>

        <!-- Any page-specific summary UI (technique grids, etc.) -->

        <div class="callout">
          <p><strong>Next:</strong> …</p>
        </div>
      </main>
    </div>
  </div>
  <docs-footer></docs-footer>
</body>
</html>
```

## Markdown File Conventions

- First line: `## Section Name` (h2 — matches the section name in llms.txt)
- Prose: plain Markdown paragraphs
- Code examples: fenced code blocks with a language tag (` ```html `, ` ```css `, ` ```js `, etc.)
- Callout/tip boxes: Markdown blockquote (`> **Label.** body text`)
- Inline HTML is allowed for one-off structural elements, but keep it minimal

## Updating llms.txt and SKILL.md

After adding or significantly changing a content MD file, regenerate `llms.txt`:
```sh
yarn --cwd docs generate:llms  # runs docs/scripts/generate-llms-txt.mjs
```

Then manually update the relevant section in `docs/src/pages/assets/SKILL.md` to reflect the change.

## Sidebar

Add new pages to `docs/src/components/docs-sidebar/docs-sidebar.html`. Group under the appropriate `<p class="sidebar-heading">` section.

## Code in HTML Slots (component-demo pattern)

Interactive demos use `<component-demo>` with named slots. **Code examples inside those slots must come from MD files** — not written inline as `&lt;`/`&gt;` entities in the HTML page.

### Why MD-first

MD files feed `llms.txt` and `SKILL.md`. If code examples only exist in HTML slots, LLMs never see them. Write example code in the relevant `docs/content/NN-topic.md` file first; the HTML slot reads from there.

### How to add a demo code block to an MD file

Place an HTML comment marker immediately before the fenced code block:

```markdown
<!-- demo:source-html -->
` ` `html
<div class="fcard">
  <p class="fcard-label" data-bascik-prop-label></p>
</div>
` ` `
```

Marker IDs are arbitrary strings (e.g. `source-html`, `output-css`, `code`, `output`).

### How to use it in an HTML slot

Use `extractDemoBlock` from `scripts/md-renderer.mjs` inside a `data-bascik-build` script. Note: the `<script data-bascik-build>` must be placed **immediately after** the `<code-block>` opening tag with no newline between them, so the injected content has no leading blank line.

```html
<div data-bascik-slot="source-html">
  <code-block data-bascik-prop-lang="html"><script data-bascik-build>
    import { join } from 'node:path';
    import { pathToFileURL } from 'node:url';
    const { extractDemoBlock } = await import(
      pathToFileURL(join(process.cwd(), 'scripts/md-renderer.mjs')).href
    );
    console.log(await extractDemoBlock('./content/03-scoped-css.md', 'source-html'));
  </script></code-block>
</div>
```

## Fix Bugs in the Package, Not the Docs

This repo is the **bascik package itself** (`pkg/`). When a rendering or build issue (e.g. minification stripping newlines, whitespace collapsing, HTML output mangled) would otherwise require a workaround in the docs content or build scripts, **fix it in `pkg/src/` instead**. Do not paper over bascik bugs with hacks in the docs layer.

## Keeping Docs in Sync with the Package

The docs site (`docs/`) consumes a **packed tarball** of the package:
```
docs/node_modules/@bascik/bascik/  ← installed from ../pkg/bascik-bascik-0.2.0.tgz
```

Whenever `pkg/src/` is changed, you must propagate the change to the docs before verifying any docs output. **Always follow these steps in order:**

### 1. Rebuild the package
```sh
cd pkg && node_modules/.bin/tsc -p tsconfig.build.json
```

### 2. Copy the rebuilt lib files into docs node_modules
```sh
cp pkg/dist/lib/javascript.js docs/node_modules/@bascik/bascik/dist/lib/javascript.js
cp pkg/dist/lib/styles.js    docs/node_modules/@bascik/bascik/dist/lib/styles.js
cp pkg/dist/lib/components.js docs/node_modules/@bascik/bascik/dist/lib/components.js
cp pkg/dist/lib/processing.js docs/node_modules/@bascik/bascik/dist/lib/processing.js
```

Copy any other lib file you changed in the same way. When in doubt, copy all of `pkg/dist/lib/` at once:
```sh
cp pkg/dist/lib/*.js docs/node_modules/@bascik/bascik/dist/lib/
```

### 3. Verify the installed file actually changed

Grep for a representative string from your change to confirm the update landed:
```sh
# Example: verify a regex fix in javascript.js
grep "your-changed-pattern" docs/node_modules/@bascik/bascik/dist/lib/javascript.js
```

If the grep returns nothing, the copy failed or you checked the wrong file.

### 4. Rebuild and check the docs
```sh
yarn --cwd docs bascik --build
```

Then inspect the relevant `docs/dist/` output to confirm the pkg change has the intended effect.

**Never assume `docs/dist/` reflects the current `pkg/src/` without completing all four steps above.** A stale installed pkg is a common source of confusing bugs where the source fix appears correct but the docs output is still broken.
