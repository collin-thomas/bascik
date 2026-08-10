#!/usr/bin/env node
/**
 * generate-llms-txt.mjs
 *
 * Reads all Markdown files from content/ in filename order,
 * concatenates them, and writes the result to src/pages/llms.txt so
 * that bascik copies it to dist/llms.txt and serves it at /llms.txt.
 *
 * Usage (from docs/):
 *   node scripts/generate-llms-txt.mjs
 *
 * Or via npm script:
 *   npm run generate:llms
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(__dirname, '..');
const contentDir = join(docsDir, 'content');
const outputFile = join(docsDir, 'src', 'pages', 'llms.txt');

/** Recursively collect all .md files under a directory, sorted by path. */
async function collectMdFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectMdFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

const mdFiles = await collectMdFiles(contentDir);

const sections = await Promise.all(
  mdFiles.map(f => readFile(f, 'utf8'))
);

// Join sections with a blank line between each
const output = sections.map(s => s.trimEnd()).join('\n\n') + '\n';

await writeFile(outputFile, output, 'utf8');

console.log(`Wrote ${outputFile} from ${mdFiles.length} section(s):`);
mdFiles.forEach(f => console.log(`  ${f.replace(docsDir + '/', '')}`));
