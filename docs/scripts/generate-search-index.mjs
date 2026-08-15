/**
 * Generates docs/src/pages/assets/search-index.json from all nav pages.
 * Each entry is one of:
 *   - a page-level entry (heading: null, text = intro paragraph)
 *   - a section-level entry (heading = h2 text, path = /page#anchor)
 *
 * Run via: node scripts/generate-search-index.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = resolve(__dirname, '..');

const { NAV } = await import('./nav.mjs');

function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

function stripMd(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')              // HTML comments
    .replace(/<!--/g, '')                         // unterminated comment starts
    .replace(/-->/g, '')                          // stray comment ends
    .replace(/```[\s\S]*?```/gm, '')              // fenced code blocks
    .replace(/`([^`\n]+)`/g, '$1')                // inline code
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')      // links
    .replace(/^#{1,6}\s+/gm, '')                  // headings
    .replace(/\*\*([^*]+)\*\*/g, '$1')            // bold
    .replace(/\*([^*\n]+)\*/g, '$1')              // italic
    .replace(/^>\s*/gm, '')                        // blockquotes
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function readMd(href) {
  // Try standard path first: /getting-started → content/getting-started.md
  const standard = join(docsDir, 'content', href.slice(1) + '.md');
  try { return await readFile(standard, 'utf8'); } catch {}
  // Fallback: /recipes/markdown → content/markdown.md
  const base = join(docsDir, 'content', href.split('/').pop() + '.md');
  try { return await readFile(base, 'utf8'); } catch {}
  return null;
}

function parseMd(md, navLabel, section, href) {
  const lines = md.split('\n');
  const entries = [];

  // Find h1 for page title
  const h1Line = lines.find(l => /^# /.test(l));
  const title = h1Line ? h1Line.slice(2).trim() : navLabel;

  // Split into sections delimited by ## headings (ignore ###)
  const sections = [];
  let cur = { heading: null, lines: [] };
  let pastH1 = false;
  for (const line of lines) {
    if (/^# /.test(line)) { pastH1 = true; continue; }
    if (!pastH1) continue;
    if (/^## /.test(line)) {
      sections.push(cur);
      cur = { heading: line.slice(3).trim(), lines: [] };
    } else {
      cur.lines.push(line);
    }
  }
  sections.push(cur);

  // Page-level entry (intro text before first ##)
  const introText = stripMd(sections[0].lines.join('\n')).slice(0, 800);
  entries.push({ title, navLabel, section, path: href, heading: null, text: introText });

  // Section-level entries
  for (const sec of sections.slice(1)) {
    if (!sec.heading) continue;
    const text = stripMd(sec.lines.join('\n')).slice(0, 800);
    const anchor = slugify(sec.heading);
    entries.push({ title, navLabel, section, path: `${href}#${anchor}`, heading: sec.heading, text });
  }

  return entries;
}

const entries = [];

for (const { section, pages } of NAV) {
  for (const { href, label } of pages) {
    const md = await readMd(href);
    if (!md) {
      // Page with no MD: add minimal entry so it still appears in search
      entries.push({ title: label, navLabel: label, section, path: href, heading: null, text: '' });
      continue;
    }
    entries.push(...parseMd(md, label, section, href));
  }
}

const outPath = join(docsDir, 'src/pages/assets/search-index.json');
await writeFile(outPath, JSON.stringify(entries));
console.log(`search index: ${entries.length} entries → src/pages/assets/search-index.json`);
