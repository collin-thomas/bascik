<p class="section-label">Internals</p>

# Testing

<p class="page-intro">Bascik uses <a href="https://vitest.dev" target="_blank" rel="noopener">Vitest</a> for unit tests, coverage, and benchmarks. All test files live alongside the source files they exercise, using the <code>*.test.ts</code> naming convention.</p>

## Running Tests

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
  javascript.ts / javascript.test.ts       ← attribute scoping, script namespacing
  styles.ts / styles.test.ts              ← CSS transforms, deduplication
  names.ts / names.test.ts               ← unique ID generation, obfuscation hashing
  build-scripts.ts / build-scripts.test.ts ← data-bascik-build execution
  processing.ts / processing.test.ts      ← end-to-end transpilation pipeline
  config.ts / config.test.ts             ← config loading and merging
  userConfig.ts / userConfig.test.ts     ← user config file resolution
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
  bench("simple page — one component", () => {
    recursivelyTranspile(simpleHtml, componentList);
  });

  bench("complex page — nested components", () => {
    recursivelyTranspile(complexHtml, componentList);
  });
});
```

## TypeScript Checking

The package uses two tsconfig files:

- `tsconfig.json` — used by Vitest; includes test files (`src/**/*.test.ts`, `bench/**/*.bench.ts`).
- `tsconfig.build.json` — used by `tsc` for production builds; excludes test files and emits to `dist/`.

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
