# Testing

Bascik has two separate test suites: **unit tests** (Vitest) that verify individual library modules, and **end-to-end tests** (Playwright) that build and browser-test the full transpilation pipeline against a fixture site.

## Running Unit Tests

All commands are run from the `pkg/` directory:

```sh
# Interactive watch mode (re-runs on file changes)
yarn test

# Single run (used in CI)
yarn test:ci

# Single run with full coverage report
yarn test:coverage

# Run benchmarks
yarn bench
```

## Running E2E Tests

End-to-end tests are also run from `pkg/`:

```sh
yarn e2e
```

This builds the fixture site (using the current `dist/`) and then runs Playwright against it. The first run requires the package to be built first:

```sh
yarn build && yarn e2e
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
  bascik.config.js       ← fixture config (obfuscateAttributeNames: false)
  playwright.config.ts   ← Playwright config; builds + serves fixture before tests
  server.mjs             ← minimal static HTTP server for dist/
  src/
    pages/               ← one HTML page per feature under test
    components/          ← components used by those pages
  tests/                 ← Playwright test files (one per page)
```

Playwright's `webServer` hook runs two commands before any test:

1. `node dist/index.js --config bascik.config.js --build`: transpiles the fixture site into `e2e/dist/`
2. `node server.mjs 4200`: serves `dist/` on `http://localhost:4200`

Tests then navigate to pages on that server and assert against the live browser DOM.

## Fixture Design

`obfuscateAttributeNames` is set to `false` in the fixture config so Playwright selectors can use readable scoped names:

```js
// pkg/e2e/bascik.config.js
export const bascikConfig = {
  obfuscateAttributeNames: false,  // keeps names like bascik__my-comp__btn
  scopeScriptBlocks: true,
  scopeAttribute: { class: true, id: true, name: true },
};
```

Each fixture page renders two or more instances of the component under test so isolation can be verified, changes to instance A must not affect instance B.

## Test Files

There are 50 Playwright test files, each paired with a fixture page:

```text
pkg/e2e/tests/
  css-scoping.test.ts          ← class/element-type CSS scoping, instance isolation
  css-advanced.test.ts         ← :is(), :where(), :not() with scoped selectors
  css-combinators.test.ts      ← descendant, child, sibling combinators
  css-complex-selectors.test.ts
  css-has.test.ts              ← :has() with scoped inner selectors
  css-layers.test.ts           ← @layer ordering and scoping
  css-pseudo.test.ts           ← :hover, :focus, :nth-child, etc.
  css-supports.test.ts         ← @supports blocks
  css-transitions.test.ts      ← transition/animation with scoped classes
  css-grid.test.ts             ← grid/flex layout properties pass through
  css-dedup.test.ts            ← duplicate CSS rule deduplication
  css-vars-multi.test.ts       ← CSS custom properties across instances
  css-anchor.test.ts           ← CSS anchor positioning
  css-at-property.test.ts      ← @property at-rule scoping
  css-counter-style.test.ts    ← @counter-style scoping
  css-nth-child-of.test.ts     ← :nth-child(n of .class) syntax
  css-starting-style.test.ts   ← @starting-style blocks
  css-view-transition.test.ts  ← CSS view transition names
  font-face.test.ts            ← @font-face is not scoped
  root-vars.test.ts            ← :root variables hoist correctly
  nested-vars.test.ts          ← nested CSS variable references
  runtime-vars.test.ts         ← CSS variable changes at runtime
  inline-style.test.ts         ← inline style attributes pass through
  nesting.test.ts              ← native CSS nesting (&)
  new-selectors.test.ts        ← newer pseudo-classes

  slots.test.ts                ← default and named slots, fallback content
  slot-component.test.ts       ← component used inside a slot
  props.test.ts                ← data-bascik-prop-* substitution
  attr-inheritance.test.ts     ← attribute pass-through
  attr-props.test.ts           ← combined attribute + prop patterns

  script-isolation.test.ts     ← scoped JS: per-instance vs shared selectors
  js-attr-api.test.ts          ← scoped id/class/name in JS attribute access
  js-advanced.test.ts          ← complex scoped JS patterns
  js-limitations.test.ts       ← innerHTML / insertAdjacentHTML behaviour
  async-js.test.ts             ← scoped queries inside async callbacks
  dom-querying.test.ts         ← querySelector, getElementById with scoped names
  dynamic-dom.test.ts          ← dynamically added elements
  id-mutation.test.ts          ← runtime id changes
  classlist.test.ts            ← classList.add/remove with scoped names
  classname-multi.test.ts      ← elements with multiple scoped classes
  form-scoping.test.ts         ← name attribute scoping on form elements
  observers.test.ts            ← MutationObserver, IntersectionObserver
  event-delegation.test.ts     ← event bubbling through scoped trees
  window-events.test.ts        ← window-level event listeners
  anim-events.test.ts          ← animationstart/end events
  cross-component-isolation.test.ts ← styles from one component don't bleed into another
  deep-nesting.test.ts         ← components nested several levels deep
  no-css.test.ts               ← components with no CSS file
  svg.test.ts                  ← SVG elements inside components
  head-components.test.ts      ← components rendered into <head>
```

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

Each library module has a paired test file:

```text
pkg/src/lib/
  components.ts / components.test.ts       ← tag detection, slot/prop/attr logic
  components.ts / list-components.test.ts  ← listComponents ordering vs build scripts
  javascript.ts / javascript.test.ts       ← attribute scoping, script namespacing
  styles.ts / styles.test.ts              ← CSS transforms, deduplication
  names.ts / names.test.ts               ← unique ID generation, obfuscation hashing
  build-scripts.ts / build-scripts.test.ts ← data-bascik-build execution
  processing.ts / processing.test.ts      ← end-to-end transpilation pipeline
  config.ts / config.test.ts             ← config loading and merging
  userConfig.ts / userConfig.test.ts     ← user config file resolution
  init.ts / init.test.ts                 ← bascik init scaffolding
  sitemap.ts / sitemap.test.ts           ← sitemap.xml and robots.txt generation
  file-system.ts / file-system.test.ts   ← filesystem helpers
  paths.ts / paths.test.ts              ← path ↔ HTTP URL conversion
  mem.ts / mem.test.ts                  ← memory store
  mime.ts / mime.test.ts               ← MIME map
  events.ts / events.test.ts           ← EventEmitter singleton
  http2.ts / http2.test.ts             ← HTTP/2 server
  pki.ts / pki.test.ts                ← TLS cert generation
  watch.ts / watch.test.ts             ← chokidar file watchers
```

## Writing Tests

Tests use the standard Vitest `describe` / `it` / `expect` API. Because library modules depend on `BascikConfig` (a module-level singleton), tests that need a specific configuration use `vi.mock` to stub it:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("../config.ts", () => ({
  BascikConfig: {
    scopeScriptBlocks: true,
    scopeAttribute: { class: true, id: true, name: true },
    obfuscateAttributeNames: false,
    verboseLogging: false,
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

## Contributing a Fix

1. Fork the repository and create a branch.
2. Make your changes in `pkg/src/`.
3. Add or update tests in the paired `*.test.ts` file.
4. Run `yarn test` and ensure all tests pass.
5. Run `yarn typecheck` to confirm there are no TypeScript errors.
6. Open a pull request against `main`.
