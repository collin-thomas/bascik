#!/usr/bin/env node
/**
 * generate-llms-txt.ts
 *
 * Reads all Markdown files from content/ in filename order,
 * concatenates them, and writes the result to src/pages/llms.txt so
 * that bascik copies it to dist/llms.txt and serves it at /llms.txt.
 *
 * Usage (from docs/):
 *   node scripts/generate-llms-txt.ts
 *
 * Or via Yarn workspace script:
 *   yarn workspace bascik-docs generate:llms
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsDir = join(__dirname, '..');
const contentDir = join(docsDir, 'content');
const outputFile = join(docsDir, 'src', 'pages', 'llms.txt');

/** Recursively collect all .md files under a directory, sorted by path. */
async function collectMdFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
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

/** Files to exclude from llms.txt (legal/meta content that isn't useful to LLMs). */
const EXCLUDE = new Set(['license.md']);

const mdFiles = (await collectMdFiles(contentDir)).filter(
  f => !EXCLUDE.has(f.split('/').pop()!)
);

const sections = await Promise.all(
  mdFiles.map(f => readFile(f, 'utf8'))
);

const output = sections.map(s => s.trimEnd()).join('\n\n') + '\n';

await writeFile(outputFile, output, 'utf8');

console.log(`Wrote ${outputFile} from ${mdFiles.length} section(s):`);
mdFiles.forEach(f => console.log(`  ${f.replace(docsDir + '/', '')}`));
