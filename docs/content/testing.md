# Testing

Bascik projects can include two kinds of JavaScript: server scripts that run in Node.js on every request, and browser scripts inside components. Both follow the same testing principle: extract the logic you care about into a plain `.mjs` module and test it with Vitest. The module is the single source of truth; whatever runs in production is derived from it.

## Testing server scripts

Server scripts (`<script data-bascik-server>`) already run in Node.js, so extracting logic is straightforward. Pull any non-trivial functions into a sibling module:

```text
src/components/my-widget/
  my-widget.html          ← component HTML
  widget-logic.mjs        ← pure functions, exported
  widget-logic.test.mjs   ← tests
```

The server script imports directly:

```html
<script data-bascik-server>
  import { myPureFunction } from './widget-logic.mjs';
  // use myPureFunction in the request handler
</script>
```

The test file imports the same module:

```js
import { describe, it, expect } from 'vitest';
import { myPureFunction } from './widget-logic.mjs';

describe('myPureFunction', () => {
  it('returns the expected value', () => {
    expect(myPureFunction('input')).toBe('expected output');
  });
});
```

## Testing browser scripts

Browser component scripts are IIFE-based and not importable as modules. The solution is the same: extract pure functions to a `.mjs` module, but delivering them to the browser requires a build step.

The component directory holds three files:

```text
src/components/my-widget/
  my-widget.html         ← HTML + build script
  widget-logic.mjs       ← pure functions, exported
  widget-logic-dom.js    ← DOM wiring (no IIFE wrapper)
  widget-logic.test.mjs  ← tests
```

The build script in `my-widget.html` reads both JS files and combines them into a single IIFE. Keeping everything in one `<script>` block is important: if you use two separate blocks, a minifier will rename variables independently in each one, breaking cross-block calls.

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import { join } from 'node:path';
  const base = join(process.cwd(), 'src/components/my-widget');
  const logic = await readFile(join(base, 'widget-logic.mjs'), 'utf8');
  const dom   = await readFile(join(base, 'widget-logic-dom.js'), 'utf8');
  const fns = logic
    .replace(/^export function /gm, 'function ')
    .replace(/^export const /gm, 'var ');
  console.log('<script>\n(function () {\n' + fns.trim() + '\n\n' + dom.trim() + '\n})();\n</scr' + 'ipt>');
</script>
```

Bascik executes this at build time and replaces the tag with the output: one `<script>` block containing a single IIFE with all functions inside it. The minifier can then rename variables freely because every reference is in the same scope.

> **One source of truth.** `widget-logic.mjs` is the canonical source for all pure functions. The browser bundle is generated from it on every build, so the two cannot drift apart.

## Setting up Vitest

Install Vitest and add a `vite.config.js` in your project root:

```sh
npm install -D vitest
```

```js
import { defineConfig } from 'vite';
export default defineConfig({
  test: { include: ['src/**/*.test.mjs'] },
});
```

Then add a test script to `package.json`:

```json
"scripts": {
  "test": "vitest run"
}
```

A test file imports directly from the logic module, with no build step and no browser:

```js
import { describe, it, expect } from 'vitest';
import { myPureFunction } from './widget-logic.mjs';

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

The split is clean: everything in `widget-logic.mjs` gets unit tests; the wiring in `widget.html` does not.

## Real example: search

The docs site uses this pattern for its search component. `search-logic.mjs` exports five functions:

| Function | What it does |
|---|---|
| `tokens(q)` | Splits a query string into words ≥2 chars |
| `score(entry, q, toks)` | Returns a tier-based relevance score (navLabel > heading > text) |
| `snippet(text, q, toks)` | Extracts ~120 chars centred on the first match |
| `basePath(path)` | Strips the hash fragment from a URL path |
| `buildResults(index, q, toks, limit)` | Returns the ordered result array |

The `docs-search.html` component inlines them via the build-time pattern above. `search-logic.test.mjs` covers tier ordering guarantees, dominant-page grouping, deduplication, and edge cases like empty queries.

```sh
yarn workspace bascik-docs test
```
