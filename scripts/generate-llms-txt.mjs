#!/usr/bin/env node
/**
 * generate-llms-txt.mjs
 *
 * Reads all Markdown files from docs/content/ in filename order,
 * concatenates them, and writes the result to llms.txt at the repo root.
 *
 * Usage (from any directory):
 *   node scripts/generate-llms-txt.mjs
 *
 * Or via npm script in docs/:
 *   npm run generate:llms
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const contentDir = join(repoRoot, 'docs', 'content');
const outputFile = join(repoRoot, 'llms.txt');

const entries = await readdir(contentDir);
const mdFiles = entries
  .filter(f => f.endsWith('.md'))
  .sort();

const sections = await Promise.all(
  mdFiles.map(f => readFile(join(contentDir, f), 'utf8'))
);

// Join sections with a blank line between each
const output = sections.map(s => s.trimEnd()).join('\n\n') + '\n';

await writeFile(outputFile, output, 'utf8');

console.log(`Wrote ${outputFile} from ${mdFiles.length} section(s):`);
mdFiles.forEach(f => console.log(`  ${f}`));
