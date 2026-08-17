/**
 * article-schema.ts
 *
 * Generates a TechArticle JSON-LD script tag for a docs content page,
 * deriving headline, description, and URL from the page's own <title> and
 * <meta name="description"> so the schema stays in sync with those tags.
 *
 * Usage inside a <script data-bascik-build> block:
 *
 *   const { articleSchema } = await import(
 *     pathToFileURL(join(process.cwd(), 'scripts/article-schema.ts')).href
 *   );
 *   console.log(await articleSchema());
 */
import { readFile } from 'node:fs/promises';

export async function articleSchema(): Promise<string> {
  const pageFile = process.env.BASCIK_PAGE_FILE ?? '';
  const pagesDir = process.env.BASCIK_PAGES_DIR ?? '';
  const siteUrl = (process.env.BASCIK_SITE_URL ?? '').replace(/\/$/, '');
  if (!pageFile || !siteUrl) return '';

  const html = await readFile(pageFile, 'utf8');
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  const descMatch =
    html.match(/<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["']([^"']+)["']/i) ||
    html.match(/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*\bname=["']description["']/i);
  if (!titleMatch || !descMatch) return '';

  const headline = titleMatch[1].trim();
  const description = descMatch[1].trim();

  const relPath = pageFile.startsWith(pagesDir)
    ? pageFile.slice(pagesDir.length).replace(/^[\\/]/, '').replace(/\\/g, '/')
    : '';
  const url = `${siteUrl}/${relPath.replace(/\.html$/, '').replace(/\/index$/, '')}`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline,
    description,
    url,
    author: {
      '@type': 'Person',
      name: 'Collin Thomas',
      url: 'https://github.com/collin-thomas',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Bascik',
      url: 'https://bascik.dev',
    },
  };

  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}
