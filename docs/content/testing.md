# Testing

Bascik supports automated testing across every layer of an application, including component markup, CSS scoping, server scripts, and browser component logic.

Node 22.18.0+ natively executes TypeScript files without a separate compilation step. Test runners and build scripts import `.ts` modules directly.

## Testing Architecture

Testing a Bascik application is structured into two main tiers:

1. **Markup, Style, and E2E Testing**: Validates rendered HTML markup, CSS rules, interactive state mechanisms (such as CSS `:has()` or details toggles), and full browser workflows.
2. **TypeScript Logic Testing**: Validates pure, exported functions from server scripts (`<script data-bascik-server>`) and browser component logic modules.

## Component Markup and CSS Testing

Component templates (`.html`) can be tested directly using Vitest by inspecting the template source or the transpiled build output. This verifies structural contracts, ARIA attributes, CSS selectors, and the absence of unwanted runtime client scripts.

### Directory structure

```text
src/components/component-demo/
  component-demo.html         ← component HTML and CSS
  component-demo.test.ts      ← component markup unit tests
```

### Example test implementation

```ts
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

describe('component-demo component', () => {
  const path = join(process.cwd(), 'src/components/component-demo/component-demo.html');

  it('uses radio inputs and CSS :has() for tab state with no client script', async () => {
    const html = await readFile(path, 'utf8');

    // Verify radio input contract
    expect(html).toContain('type="radio"');
    expect(html).toContain('value="preview"');

    // Verify CSS :has() state rules exist
    expect(html).toContain(':has(');

    // Verify no runtime client script tag
    const clientScriptRegex = /<script(?![^>]*data-bascik-build)[^>]*>[\s\S]*?<\/script>/gi;
    expect(clientScriptRegex.test(html)).toBe(false);
  });
});
```

## End-to-End Browser Testing

End-to-end (E2E) testing validates full page rendering, user interactions, form submissions, and routing in real browser engines using Playwright.

### Installation

```sh
npm install -D @playwright/test
```

### Configuration (`playwright.config.ts`)

Configure Playwright to build and serve the site automatically before running tests:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:4200' },
  webServer: {
    command: 'npx bascik --build && npx bascik --serve 4200',
    port: 4200,
    reuseExistingServer: !process.env.CI,
  },
});
```

### Spec implementation (`e2e/docs-components.spec.ts`)

```ts
import { test, expect } from '@playwright/test';

test('component-demo switches tabs without JavaScript', async ({ page }) => {
  await page.goto('/components');

  const previewPane = page.locator('.demo-pane[data-pane="preview"]').first();
  const sourcePane = page.locator('.demo-pane[data-pane="code"]').first();

  await expect(previewPane).toBeVisible();
  await expect(sourcePane).toBeHidden();

  // Click Source tab label
  await page.locator('.demo-tab:has-text("Source")').first().click();

  await expect(previewPane).toBeHidden();
  await expect(sourcePane).toBeVisible();
});
```

## Server Script Testing

Server scripts (`<script data-bascik-server>`) execute in Node.js on every request. Non-trivial request logic should be extracted into standalone TypeScript modules for isolated unit testing.

### Component file layout

```text
src/components/my-widget/
  my-widget.html          ← component HTML template
  widget-logic.ts         ← pure functions (TypeScript), exported
  widget-logic.test.ts    ← unit tests (TypeScript)
```

### Server script usage

```html
<script data-bascik-server>
  import { myPureFunction } from './widget-logic.js';
  // Execute myPureFunction within the request handler
</script>
```

> **ESM Import Convention.** Standard ES module resolution under Node 24+ allows importing local TypeScript files using either runtime `.js` specifiers or `.ts` specifiers during testing.

### Unit test implementation

```ts
import { describe, it, expect } from 'vitest';
import { myPureFunction } from './widget-logic.ts';

describe('myPureFunction', () => {
  it('returns the expected value', () => {
    expect(myPureFunction('input')).toBe('expected output');
  });
});
```

## Browser Component Script Testing

Browser component scripts run in an IIFE scope and cannot be directly imported as standard ES modules. Testing browser script logic requires separating pure functions from DOM event wiring.

### Directory structure

```text
src/components/my-widget/
  my-widget.html         ← HTML template and build script
  widget-logic.ts        ← pure functions (TypeScript), exported
  widget-logic-dom.js    ← DOM event listeners and wiring
  widget-logic.test.ts   ← unit tests (TypeScript)
```

### Build script integration

A build script (`<script data-bascik-build>`) in the component template combines the logic and DOM modules into a single IIFE block at build time:

```html
<script data-bascik-build>
  import { readFile } from 'node:fs/promises';
  import { join } from 'node:path';
  const base = join(process.cwd(), 'src/components/my-widget');
  const logic = await readFile(join(base, 'widget-logic.ts'), 'utf8');
  const dom   = await readFile(join(base, 'widget-logic-dom.js'), 'utf8');
  const fns = logic
    .replace(/:\s*(?:string|number|boolean|any)/g, '')
    .replace(/^export function /gm, 'function ')
    .replace(/^export const /gm, 'var ');
  console.log('<script>\n(function () {\n' + fns.trim() + '\n\n' + dom.trim() + '\n})();\n</scr' + 'ipt>');
</script>
```

Bascik executes the build script during compilation and replaces the tag with the resulting `<script>` IIFE output.

> **Single Source of Truth.** The `widget-logic.ts` file remains the single source of truth for both unit tests and production browser output.

## Test Runner Setup

Vitest is the recommended test runner for Bascik applications.

### Installation and configuration

```sh
npm install -D vitest
```

Create `vite.config.ts` in the project root:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
```

Add the test command to `package.json`:

```json
"scripts": {
  "test": "vitest run"
}
```

Execute tests using:

```sh
npm test
```

## Testing Boundaries and Guidance

- **Component HTML and CSS**: Validate input contracts, ARIA accessibility attributes, CSS `:has()` rules, and verify that zero runtime JavaScript is shipped when CSS can handle state transitions.
- **Pure Logic Functions**: Validate scoring, filtering, formatting, sorting, tokenization, and data transformations with fast unit tests in Vitest.
- **End-to-End Workflows**: Validate multi-page user journeys, interactive clicks, visual state updates, and server routes in Playwright.

## Reference Implementation: Docs Search

The Bascik documentation search component (`docs-search.html`) implements this testing architecture. The core search engine logic (`search-logic.ts`) exports five functions:

| Function | Description |
|---|---|
| `tokens(q)` | Splits a query string into normalized tokens (≥2 characters) |
| `score(entry, q, toks)` | Calculates a tier-based relevance score (navLabel > heading > text) |
| `snippet(text, q, toks)` | Extracts a ~120 character excerpt centered on the match |
| `basePath(path)` | Strips hash fragments from URL paths |
| `buildResults(index, q, toks, limit)` | Filters, scores, and sorts search results |

`docs-search.html` inlines the logic at build time, while `search-logic.test.ts` provides comprehensive unit test coverage for scoring tiers, deduplication, and edge cases.

```sh
yarn workspace bascik-docs test
```
