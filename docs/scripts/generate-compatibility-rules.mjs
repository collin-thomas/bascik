import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const docsFile = path.resolve(__dirname, '../content/compatibility.md');
const extensionRulesFile = path.resolve(__dirname, '../../extensions/vscode-bascik/src/compatibility-rules.json');

const text = await fs.readFile(docsFile, 'utf8');
const match = text.match(/<!--\s*bascik-compatibility-rules\s*(\[[\s\S]*?\])\s*-->/);

if (!match) {
  throw new Error('Missing bascik-compatibility-rules metadata block in docs/content/compatibility.md');
}

const rules = JSON.parse(match[1]);

for (const rule of rules) {
  if (!rule.id || !rule.kind || !rule.pattern || !rule.message || !rule.suggestion) {
    throw new Error(`Invalid compatibility rule: ${JSON.stringify(rule)}`);
  }

  if (rule.kind !== 'css' && rule.kind !== 'js') {
    throw new Error(`Unsupported compatibility rule kind for ${rule.id}: ${rule.kind}`);
  }

  try {
    // Validate the pattern can be compiled by JavaScript.
    // eslint-disable-next-line no-new
    new RegExp(rule.pattern, rule.flags ?? '');
  } catch (error) {
    throw new Error(`Invalid regex for ${rule.id}: ${rule.pattern} (${error.message})`);
  }
}

await fs.mkdir(path.dirname(extensionRulesFile), { recursive: true });
await fs.writeFile(extensionRulesFile, `${JSON.stringify(rules, null, 2)}\n`, 'utf8');

console.log(`Wrote ${rules.length} compatibility rules to ${path.relative(process.cwd(), extensionRulesFile)}`);
