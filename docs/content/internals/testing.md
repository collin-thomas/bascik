# Testing

Bascik has two separate test suites: **unit tests** (Vitest) that verify individual library modules, and **end-to-end tests** (Playwright) that build and browser-test the full transpilation pipeline against a fixture site.

## Running Unit Tests

All commands can be run from the repository root:

```sh
# Interactive watch mode (re-runs on file changes)
yarn pkg:test

# Single run (used in CI)
yarn pkg:test:ci

# Single run with full coverage report
yarn pkg:test:coverage

# Run benchmarks
yarn pkg:bench
```

## Running E2E Tests

End-to-end tests are run via:

```sh
yarn pkg:e2e
```

This builds the fixture site (using the current `dist/`) and then runs Playwright against it. The first run requires the package to be built first:

```sh
yarn pkg:build && yarn pkg:e2e
```

To run a specific test file or use the Playwright UI:

```sh
# Run only CSS scoping tests
node_modules/.bin/playwright test --config e2e/playwright.config.ts e2e/tests/css-scoping.test.ts

# Open the Playwright UI for interactive debugging
node_modules/.bin/playwright test --config e2e/playwright.config.ts --ui
```

## How the E2E Suite Works

The e2e fixture is a small but complete Bascik project at `pkg/e2e/`:

```text
pkg/e2e/
  bascik.config.ts       ← fixture config (obfuscateAttributeNames: false)
  playwright.config.ts   ← Playwright config; builds + serves fixture before tests
  server.mjs             ← minimal static HTTP server for dist/
  src/
    pages/               ← one HTML page per feature under test
    components/          ← components used by those pages
  tests/                 ← Playwright test files (one per page)
```

Playwright's `webServer` hook runs two commands before any test:

1. `node dist/index.js --config bascik.config.ts --build`: transpiles the fixture site into `e2e/dist/`
2. `node server.mjs 4200`: serves `dist/` on `http://localhost:4200`

Tests then navigate to pages on that server and assert against the live browser DOM.

## Fixture Design

`obfuscateAttributeNames` is left at its default (`false`) in the fixture config so Playwright selectors can use readable scoped names like `bascik__my-comp__btn`. The only non-default values set are the site URL and the production server port:

```ts
// pkg/e2e/bascik.config.ts
import { defineConfig } from '@bascik/bascik/config';

export default defineConfig({
  siteUrl: 'http://localhost:4200',
  useWorkers: true,
  serve: { port: 9443 },
});
```

Each fixture page renders two or more instances of the component under test so isolation can be verified, changes to instance A must not affect instance B.

## Test Files

Each test file is paired with a fixture page. See the full list on [GitHub](https://github.com/collin-thomas/bascik/tree/main/pkg/e2e/tests).

## Writing a New E2E Test

1. **Add a fixture component** in `pkg/e2e/src/components/my-feature/` with an HTML file (and CSS/JS as needed).
2. **Add a fixture page** in `pkg/e2e/src/pages/my-feature-test.html` that renders two or more instances of the component.
3. **Add a test file** at `pkg/e2e/tests/my-feature.test.ts`.

A typical test file:

```ts
import { test, expect, type Locator } from '@playwright/test';

function getInstance(page, n: number): Locator {
  return page.locator('.bascik__my-feature__wrapper').nth(n);
}

test.describe('my-feature-test page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-feature-test');
  });

  test('instances are isolated', async ({ page }) => {
    const a = getInstance(page, 0);
    const b = getInstance(page, 1);
    // assert that state in A does not affect B
  });
});
```

> **Rebuild before testing.** Playwright tests run against `e2e/dist/`, which is built from the current `pkg/dist/`. If you change `pkg/src/`, run `yarn build` before `yarn e2e` so the fixture picks up the latest transpiler.



## Test Configuration

Vitest is configured in `pkg/vite.config.js`:

```js
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    benchmark: {
      include: ["bench/**/*.bench.ts"],
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.js"],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
```

Coverage is collected via V8 and written to `pkg/coverage/`. The CI script uses `text-summary` only. The full HTML report at `coverage/index.html` is useful locally.

## Test Files

Each library module has a paired test file. See the full list on [GitHub](https://github.com/collin-thomas/bascik/tree/main/pkg/src/lib).

## Writing Tests

Tests use the standard Vitest `describe` / `it` / `expect` API. Because library modules depend on `BascikConfig` (a module-level singleton), tests that need a specific configuration use `vi.mock` to stub it:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("../config.ts", () => ({
  BascikConfig: {
    scopeScriptBlocks: true,
    scopeAttribute: { class: true, id: true, name: true },
    obfuscateAttributeNames: false,
    isBuild: false,
    minifyStyles: false,
  },
}));

// Import the module under test AFTER mocking its dependencies
import { prefixElementAttribute } from "./javascript.js";

describe("prefixElementAttribute", () => {
  it("scopes class attributes in HTML", () => {
    const component = {
      name: "my-comp",
      fileContent: '<div class="btn">Click</div>',
    };
    const result = prefixElementAttribute(component, "class", "abc123");
    expect(result.fileContent).toContain("bascik__my-comp__btn");
  });
});
```

<div class="callout">
<p><strong>Important:</strong> Always import the module under test <em>after</em> calling <code>vi.mock</code>. Vitest hoists mock calls to the top of the file, but the import order still matters for ensuring the mock is in place when the module initialises its dependencies.</p>
</div>

## Benchmarks

Performance benchmarks live in `pkg/bench/` and use Vitest's built-in `bench` API. They measure the transpilation pipeline on fixed, repeatable inputs:

```ts
import { bench, describe } from "vitest";
import { recursivelyTranspile } from "../src/lib/processing.ts";

describe("recursivelyTranspile", () => {
  bench("simple page - one component", () => {
    recursivelyTranspile(simpleHtml, componentList);
  });

  bench("complex page - nested components", () => {
    recursivelyTranspile(complexHtml, componentList);
  });
});
```

## TypeScript Checking

The package uses two tsconfig files:

- `tsconfig.json`: used by Vitest; includes test files (`src/**/*.test.ts`, `bench/**/*.bench.ts`).
- `tsconfig.build.json`: used by `tsc` for production builds; excludes test files and emits to `dist/`.

Run type checking without emitting output:

```sh
yarn typecheck
```

The `docs/` package also has a `tsconfig.json` covering `docs/scripts/`. It uses the TypeScript from `pkg/` (docs has no own typescript package):

```sh
npx --prefix pkg tsc -p docs/tsconfig.json --noEmit
```

## Contributing a Fix

1. Fork the repository and create a branch.
2. Make your changes in `pkg/src/`.
3. Add or update tests in the paired `*.test.ts` file.
4. Run `yarn test` and ensure all tests pass.
5. Run `yarn typecheck` to confirm there are no TypeScript errors.
6. Open a pull request against `main`.
