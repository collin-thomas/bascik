# Bascik Docs — Copilot Instructions

This file applies to all work inside `/docs/`. Read it before creating or editing docs pages.

## Content Lives in Markdown

**All docs page content must be written in `docs/content/*.md` files, not directly in the HTML page.**

The Markdown files serve three purposes simultaneously:
1. They are the canonical source for the rendered docs page (via `data-bascik-build`)
2. They feed `llms.txt` (via `scripts/generate-llms-txt.mjs`)
3. They feed `SKILL.md` (the Copilot skill file at the repo root)

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
yarn --cwd docs generate:llms
```

Then manually update the relevant section in `SKILL.md` at the repo root to reflect the change.

## Sidebar

Add new pages to `docs/src/components/docs-sidebar/docs-sidebar.html`. Group under the appropriate `<p class="sidebar-heading">` section.

## Fix Bugs in the Package, Not the Docs

This repo is the **bascik package itself** (`pkg/`). When a rendering or build issue (e.g. minification stripping newlines, whitespace collapsing, HTML output mangled) would otherwise require a workaround in the docs content or build scripts, **fix it in `pkg/src/` instead**. Do not paper over bascik bugs with hacks in the docs layer.
