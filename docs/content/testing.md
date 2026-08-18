# Testing Site Logic

Bascik projects can include two kinds of scripts: server scripts that run in Node.js on every request, and browser scripts inside components. Both follow the same testing principle: extract the logic you care about into a plain TypeScript `.ts` module and test it with Vitest. The module is the single source of truth; whatever runs in production is derived from it.

Since Bascik runs on Node 24+, your server scripts and build scripts can import and execute `.ts` files natively with no separate compiler step and no configuration.

## Testing server scripts

Server scripts (`<script data-bascik-server>`) already run in Node.js, so extracting logic is straightforward. Pull any non-trivial functions into a sibling TypeScript module:

```text
src/components/my-widget/
  my-widget.html          ← component HTML
  widget-logic.ts         ← pure functions (TypeScript), exported
  widget-logic.test.ts    ← tests (TypeScript)
```

The server script imports directly:

```html
<script data-bascik-server>
  import { myPureFunction } from './widget-logic.js';
  // use myPureFunction in the request handler
</script>
```

> **ESM Import Convention.** In standard ES modules, when importing local TypeScript modules under Node 24+, you can import them using their runtime `.js` extension, or Vitest and build scripts can import them directly via `.ts`.

The test file imports the same module:

```ts
import { describe, it, expect } from 'vitest';
import { myPureFunction } from './widget-logic.ts';

describe('myPureFunction', () => {
  it('returns the expected value', () => {
    expect(myPureFunction('input')).toBe('expected output');
  });
});
```

## Testing browser scripts

Browser component scripts are IIFE-based and not importable as modules. The solution is the same: extract pure functions to a `.ts` module, but delivering them to the browser requires a build step.

The component directory holds three files:

```text
src/components/my-widget/
  my-widget.html         ← HTML + build script
  widget-logic.ts        ← pure functions (TypeScript), exported
  widget-logic-dom.js    ← DOM wiring (no IIFE wrapper)
  widget-logic.test.ts   ← tests (TypeScript)
```

The build script in `my-widget.html` reads both files and combines them into a single IIFE. Keeping everything in one `<script>` block is important: if you use two separate blocks, a minifier will rename variables independently in each one, breaking cross-block calls.

Since browsers do not run TypeScript directly, our build script can strip simple types on the fly when assembling the bundle:

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import { join } from 'node:path';
  const base = join(process.cwd(), 'src/components/my-widget');
  const logic = await readFile(join(base, 'widget-logic.ts'), 'utf8');
  const dom   = await readFile(join(base, 'widget-logic-dom.js'), 'utf8');
  const fns = logic
    .replace(/:\s*(?:string|number|boolean|any)/g, '') // strip simple TypeScript type annotations
    .replace(/^export function /gm, 'function ')
    .replace(/^export const /gm, 'var ');
  console.log('<script>\n(function () {\n' + fns.trim() + '\n\n' + dom.trim() + '\n})();\n</scr' + 'ipt>');
</script>
```

Bascik executes this at build time and replaces the tag with the output: one `<script>` block containing a single IIFE with all functions inside it. The minifier can then rename variables freely because every reference is in the same scope.

> **One source of truth.** `widget-logic.ts` is the canonical source for all pure functions. The browser bundle is generated from it on every build, so the two cannot drift apart.

## Setting up Vitest

Install Vitest and add a `vite.config.ts` in your project root:

```sh
npm install -D vitest
```

```ts
import { defineConfig } from 'vite';
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
```

Then add a test script to `package.json`:

```json
"scripts": {
  "test": "vitest run"
}
```

A test file imports directly from the logic module, with no build step and no browser:

```ts
import { describe, it, expect } from 'vitest';
import { myPureFunction } from './widget-logic.ts';

describe('myPureFunction', () => {
  it('returns the expected value', () => {
    expect(myPureFunction('input')).toBe('expected output');
  });
});
```

Run with:

```sh
npm test
```

## What to test

**Test pure logic functions**: scoring, filtering, formatting, sorting, tokenisation, data transformation. Anything that takes inputs and returns outputs with no side effects.

**Skip DOM interaction and HTTP handlers**: event listeners, `querySelector` calls, and render functions are low-value unit tests. For browser scripts, they are better covered by E2E tests (Playwright) or manual smoke-testing. For server scripts, focus on the data logic, not the `res.send` wiring.

The split is clean: everything in `widget-logic.ts` gets unit tests; the wiring in `widget.html` does not.

## Real example: search

The docs site uses this pattern for its search component. `search-logic.ts` exports five functions:

| Function | What it does |
|---|---|
| `tokens(q)` | Splits a query string into words ≥2 chars |
| `score(entry, q, toks)` | Returns a tier-based relevance score (navLabel > heading > text) |
| `snippet(text, q, toks)` | Extracts ~120 chars centred on the first match |
| `basePath(path)` | Strips the hash fragment from a URL path |
| `buildResults(index, q, toks, limit)` | Returns the ordered result array |

The `docs-search.html` component inlines them via the build-time pattern above. `search-logic.test.ts` covers tier ordering guarantees, dominant-page grouping, deduplication, and edge cases like empty queries.

```sh
yarn workspace bascik-docs test
```
