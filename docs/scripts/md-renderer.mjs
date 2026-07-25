/**
 * md-renderer.mjs
 *
 * Renders a Markdown file to HTML for use inside a Bascik docs page.
 * Import this from a `data-bascik-build` script block in a page:
 *
 *   <script data-bascik-build>
 *     import { join } from 'node:path';
 *     import { pathToFileURL } from 'node:url';
 *     const { renderMd } = await import(
 *       pathToFileURL(join(process.cwd(), 'scripts/md-renderer.mjs')).href
 *     );
 *     console.log(await renderMd('./content/16-performance.md'));
 *   </script>
 *
 * Transformations applied on top of standard marked output:
 *   - Fenced code blocks  →  <code-block data-bascik-prop-lang="..."> component
 *   - Blockquotes         →  <div class="callout">
 *
 * Because `data-bascik-build` output is processed before component resolution,
 * the emitted <code-block> tags are resolved normally by Bascik.
 */

import { readFile } from 'node:fs/promises';
import { marked } from 'marked';

/**
 * Reads a Markdown file and returns the rendered HTML string.
 *
 * @param {string} filePath - Path relative to process.cwd() (the project root).
 * @param {object} [options]
 * @param {boolean} [options.skipFirstHeading=false] - Strip the first <h1>–<h6> from
 *   the output. Useful when the page HTML shell already contains a <h1> that matches
 *   the section heading at the top of the MD file (needed for llms.txt consistency).
 */
export async function renderMd(filePath, { skipFirstHeading = false } = {}) {
  const md = await readFile(filePath, 'utf8');
  let html = marked(md);

  // Optionally strip the first heading (h1–h6)
  if (skipFirstHeading) {
    html = html.replace(/^<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>\n?/, '');
  }

  // Convert <pre><code class="language-X"> → <code-block data-bascik-prop-lang="X">
  // marked already HTML-escapes code content, so it passes safely into the component slot.
  html = html.replace(
    /<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g,
    (_, lang, code) => `<code-block data-bascik-prop-lang="${lang}">${code}</code-block>\n`
  );
  // Code blocks with no language tag
  html = html.replace(
    /<pre><code>([\s\S]*?)<\/code><\/pre>/g,
    (_, code) => `<code-block data-bascik-prop-lang="text">${code}</code-block>\n`
  );

  // Convert <blockquote> → <div class="callout">
  html = html.replace(/<blockquote>\n?/g, '<div class="callout">');
  html = html.replace(/\n?<\/blockquote>/g, '</div>');

  return html;
}
