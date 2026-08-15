/**
 * Generates OG and Twitter card <meta> tags for the current page.
 * Reads title and description from the raw page file itself, so they never
 * need to be duplicated in the page source.
 *
 * Usage inside a <script data-bascik-build> block:
 *
 *   import { join } from 'node:path';
 *   import { pathToFileURL } from 'node:url';
 *   const { openGraph } = await import(
 *     pathToFileURL(join(process.cwd(), 'scripts/open-graph.mjs')).href
 *   );
 *   console.log(await openGraph());
 */
import { readFile } from 'node:fs/promises';

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractDescription(html) {
  const metaRe = /<meta([^>]+)>/gi;
  let m;
  while ((m = metaRe.exec(html)) !== null) {
    const attrs = m[1];
    if (/name\s*=\s*["']description["']/i.test(attrs)) {
      const cm = /content\s*=\s*"([^"]+)"/i.exec(attrs);
      if (cm) return cm[1].trim();
    }
  }
  return '';
}

export async function openGraph() {
  const siteUrl = (process.env.BASCIK_SITE_URL ?? '').replace(/\/$/, '');
  const pageFile = process.env.BASCIK_PAGE_FILE ?? '';
  const pagesDir = process.env.BASCIK_PAGES_DIR ?? '';

  if (!siteUrl || !pageFile || !pagesDir) return '';

  const html = await readFile(pageFile, 'utf8');
  const title = extractTitle(html);
  const description = extractDescription(html);

  const relPath = pageFile.startsWith(pagesDir)
    ? pageFile.slice(pagesDir.length).replace(/^[\\/]/, '')
    : '';
  const withoutExt = relPath.replace(/\.html$/, '');
  const urlPath = withoutExt === 'index' ? '/' : `/${withoutExt}`;
  const url = `${siteUrl}${urlPath}`;

  const tags = [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Bascik" />`,
    `<meta property="og:url" content="${url}" />`,
  ];
  if (title) tags.push(`<meta property="og:title" content="${title}" />`);
  if (description) tags.push(`<meta property="og:description" content="${description}" />`);
  tags.push(`<meta name="twitter:card" content="summary" />`);
  if (title) tags.push(`<meta name="twitter:title" content="${title}" />`);
  if (description) tags.push(`<meta name="twitter:description" content="${description}" />`);

  return tags.join('\n');
}
