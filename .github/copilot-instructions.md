# Bascik Docs — Copilot Instructions

This file applies to all work inside `/docs/`. Read it before creating or editing docs pages.

## Content Lives in Markdown

**All docs page content must be written in `docs/content/*.md` files, not directly in the HTML page.**

The Markdown files serve three purposes simultaneously:
1. They are the canonical source for the rendered docs page (via `data-bascik-build`)
2. They feed `llms.txt` (generated automatically via `exec` in `docs/bascik.config.ts`)
3. They feed `SKILL.md` (the Copilot skill file at `docs/src/pages/assets/SKILL.md`, served at `/assets/SKILL.md`)

**When adding or updating docs content:**
- Write the prose and code examples in the appropriate `docs/content/topic.md` file
- The HTML page is a shell — edit it only for page-specific chrome (custom styles, decorative UI, score grids, etc.)
- Never duplicate prose between the MD file and the HTML file

## How Pages Render from MD

Each docs page that has a corresponding MD file uses a `<script data-bascik-build>` block inside `<main class="docs-content">`:

```html
<!-- Content rendered from docs/content/topic.md at build time.
     To update page content, edit the MD file — not this file. -->
<script data-bascik-build>
  import { join } from 'node:path';
  import { pathToFileURL } from 'node:url';
  const { renderMd } = await import(
    pathToFileURL(join(process.cwd(), 'scripts/md-renderer.ts')).href
  );
  console.log(await renderMd('./content/topic.md'));
</script>
```

The `renderMd` helper (`docs/scripts/md-renderer.ts`) applies these transformations:
- Fenced code blocks (` ``` `) → `<code-block data-bascik-prop-lang="…">` component
- Blockquotes (`>`) → `<div class="callout">`

## HTML Page Shell Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- title, styles.css, any page-specific <style> -->
</head>
<body>
  <docs-nav></docs-nav>
  <div class="container">
    <div class="docs-layout">
      <docs-sidebar></docs-sidebar>
      <main class="docs-content">
        <p class="section-label">Category</p>
        <!-- h1, page-intro p, and all content come from MD -->
        <script data-bascik-build>…</script>

        <!-- Any page-specific summary UI (technique grids, etc.) -->

        <div class="callout">
          <p><strong>Next:</strong> …</p>
        </div>
      </main>
    </div>
  </div>
  <docs-footer></docs-footer>
</body>
</html>
```

## Markdown File Conventions

- First lines: `# Page Title` (h1), then a plain intro paragraph (styled as page-intro via CSS)
- Prose: plain Markdown paragraphs
- Section headings: `##` (h2), sub-sections: `###` (h3)
- Code examples: fenced code blocks with a language tag (` ```html `, ` ```css `, ` ```js `, etc.)
- Callout/tip boxes: Markdown blockquote (`> **Label.** body text`)
- No inline HTML in MD files — keep MD pure Markdown

## Updating SKILL.md and create/assets/SKILL.md

**Do not run `#pre-push.prompt.md` or pre-push scripts automatically.** The user handles running pre-push steps.

Note: `llms.txt` is generated automatically by Bascik via `exec` in `docs/bascik.config.ts` whenever `docs/content/` changes.

If manually updating or propagating `SKILL.md` when specifically requested:

```sh
yarn create:prepack
```

These files must stay in sync. A content change that lands in `docs/content/*.md` but not `SKILL.md` (or vice versa) means Copilot is working from stale guidance, which is how bugs like "use `querySelector` for per-instance elements" go undetected.

## Sidebar

Add new pages to `docs/src/components/docs-sidebar/docs-sidebar.html`. Group under the appropriate `<p class="sidebar-heading">` section.

## Code in HTML Slots (component-demo pattern)

Interactive demos use `<component-demo>` with named slots. **Code examples inside those slots must come from MD files** — not written inline as `&lt;`/`&gt;` entities in the HTML page.

### Why MD-first

MD files feed `llms.txt` and `SKILL.md`. If code examples only exist in HTML slots, LLMs never see them. Write example code in the relevant `docs/content/topic.md` file first; the HTML slot reads from there.

### How to add a demo code block to an MD file

Place an HTML comment marker immediately before the fenced code block:

```markdown
<!-- demo:source-html -->
` ` `html
<div class="fcard">
  <p class="fcard-label" data-bascik-prop-label></p>
</div>
` ` `
```

Marker IDs are arbitrary strings (e.g. `source-html`, `output-css`, `code`, `output`).

### How to use it in an HTML slot

Use `extractDemoBlock` from `scripts/md-renderer.ts` inside a `data-bascik-build` script. Bascik trims slot content at build time, so normal indentation around the `<script>` tag is fine — no collapsed one-liner is needed.

```html
<div data-bascik-slot="source-html">
  <code-block data-bascik-prop-lang="html">
    <script data-bascik-build>
      import { join } from 'node:path';
      import { pathToFileURL } from 'node:url';
      const { extractDemoBlock } = await import(
        pathToFileURL(join(process.cwd(), 'scripts/md-renderer.ts')).href
      );
      console.log(await extractDemoBlock('./content/03-scoped-css.md', 'source-html'));
    </script>
  </code-block>
</div>
```

## Fix Bugs in the Package, Not the Docs

This repo is the **bascik package itself** (`pkg/`). When a rendering or build issue (e.g. minification stripping newlines, whitespace collapsing, HTML output mangled) would otherwise require a workaround in the docs content or build scripts, **fix it in `pkg/src/` instead**. Do not paper over bascik bugs with hacks in the docs layer.

## Keeping SEO Meta in Sync with Content

Each docs page has a `<title>` and `<meta name="description">` hardcoded in its HTML file. These are **not** generated from the Markdown — they are maintained manually.

**When editing a `docs/content/*.md` file**, check whether the h1 or intro paragraph changed in a way that should be reflected in the corresponding HTML page's `<title>` or `<meta name="description">`. If so, update both together.

The mapping is straightforward: `docs/content/topic.md` corresponds to `docs/src/pages/topic.html`. The `<title>` should reflect the page's h1 (with ` - Bascik Docs` suffix for non-homepage pages), and the description should be a concise search-optimised summary drawn from the intro paragraph.

## Keeping the Changelog Up to Date

`CHANGELOG.md` is not actively maintained during pre-1.0 development — the 1.0.0 release entry will be written as a high-level announcement. **Once 1.0.0 ships**, resume normal changelog discipline: add an entry to `[Unreleased]` whenever you add a feature, fix a bug, or make any user-visible change to `pkg/src/`. One bullet per change, grouped under `### Added`, `### Fixed`, or `### Changed`.

## Keeping the Compatibility Doc Up to Date

`docs/content/compatibility.md` tracks which CSS and JavaScript patterns Bascik's scoping engine handles. **Whenever a CSS or JS scoping capability is added, changed, or fixed**, update the relevant table row (or add a new one) in that file before finishing the task.

- New capability: add a row with ✅ and a concise Notes entry.
- Fixed or improved: update the Status and/or Notes of the existing row.
- Intentionally unsupported: add a row with 🚫 and an explanation.

After editing `compatibility.md`, run `#pre-push.prompt.md` is NOT required. The user handles running pre-push steps.

## Keeping Docs in Sync with the Package

The repo uses **Yarn workspaces**. `node_modules/@bascik/bascik` is a symlink to `pkg/`, so the docs always resolve the live source, with no pack, copy, or lock-file deletion needed.

Whenever `pkg/src/` is changed, propagate the change to the docs in two steps:

### 1. Rebuild the package
```sh
yarn pkg:build
```

### 2. Rebuild and check the docs
```sh
yarn docs:build
```

Then inspect the relevant `docs/dist/` output to confirm the pkg change has the intended effect.

## Tests and Coverage

**When adding, removing, or significantly changing tests in `pkg/src/`:**

- The testing docs (`docs/content/internals/testing.md`) describe the test approach, not an enumerated list of files. The "Test Files" section links to GitHub which is always current. You only need to update the prose if the testing *patterns* change (e.g. a new mock strategy, a new test runner, new helpers).
- The coverage numbers shown on the testing page are read from `pkg/test-coverage.json` (unit tests) and `pkg/e2e-test-coverage.json` (E2E build-step coverage) at docs build time. Do not run `#pre-push.prompt.md` or pre-push scripts automatically after adding tests. The user handles running pre-push steps.

**When changing `pkg/src/lib/dev-server.md` (or adding to the live-reload / SSE / watch system):**
Update `docs/content/internals/dev-server.md` to reflect the change. This page is the source of truth for how the dev server and watch system work.

**General principle:** the three files that must stay in sync are `llms.txt`, `SKILL.md`, and the relevant `docs/content/internals/*.md`. The copilot-instructions file is the enforcement mechanism — add notes here when a new sync relationship is created.
files that must stay in sync are `SKILL.md`
## License Source of Truth

The license lives in **three places** that must stay in sync:

- `docs/content/license.md`: the web-formatted version rendered at `https://bascik.dev/license`
- `LICENSE` (repo root): plain-text version; **required** for GitHub license detection and as the `prepack` source
- `pkg/LICENSE` and `create/LICENSE`: copies for the npm tarballs; synced automatically on publish via the `prepack` script in each `package.json`

**When updating the license terms:**
1. Edit `docs/content/license.md` (the human-readable web version)
2. Mirror those changes to the root `LICENSE` (same terms, plain-text format)
3. Run `cp LICENSE pkg/LICENSE && cp LICENSE create/LICENSE` to sync the package copies immediately

Do **not** delete the root `LICENSE`: GitHub reads it for repo-level license detection. Do not edit `pkg/LICENSE` or `create/LICENSE` directly; they are derived files.

## Node 24 — Native TypeScript Support

This project runs on **Node 24**. Node natively strips TypeScript types, with no transpiler or extra flags needed for erasable syntax.

- `node example.ts` works directly (Node 22.18+ with only erasable syntax, no flags required).
- Erasable syntax: type annotations, interfaces, type aliases, `import type`. These are stripped at runtime.
- Non-erasable syntax (`enum`, parameter properties, namespaces with runtime code) is **not** supported — a separate transpile step is required for those.
- Node does **not** type-check. Run `npx tsc --noEmit` separately for type checking.
- No `tsconfig.json` is needed for Node to run `.ts` files.

**Practical implication:** `data-bascik-build` and `data-bascik-server` scripts can import `.ts` helper files and Node handles them natively. Bascik does not need to add its own type-stripping layer for server-side or build-time scripts.

## Agent Environment Notes

### Use Root Scripts or `yarn workspace <pkg> <script>`

Commands can be run directly from the root using helper scripts (`yarn build`, `yarn dev`, `yarn test`, `yarn typecheck`, `yarn pkg:build`, `yarn docs:dev`, etc.) or using `yarn workspace <pkg> <script>`.

The repo uses **Modern Yarn 4** (`yarn@4.6.0`) with `nodeLinker: node-modules`. Ctrl+C on interactive watch mode commands exits cleanly with code 0/130 and zero `ELIFECYCLE` error messages.

```sh
yarn test       # vitest watch mode (@bascik/bascik)
yarn docs:dev   # docs dev server (bascik-docs)
```

### VS Code Sandbox — Commands That Need Network Will Hang

The agent runs inside a VS Code sandbox. Commands that bind to a port or make outbound connections (Playwright E2E tests, `yarn dev`, `curl`) hang indefinitely when run inside the sandbox. Do **not** retry these commands with slight variations — they will all hang.

- **Unit tests** (`npx vitest run`) work fine; no network is needed.
- **E2E tests** (`npx playwright test`) require network and must be run by the user in a normal terminal outside the sandbox. Tell the user to run them and report the output.
- If a sandboxed terminal command hangs, accept it and move on. Do not loop.

### Test Framework: Vitest 4

The project uses **Vitest 4** (`"vitest": "^4.1.10"`). Vitest 4 introduced breaking changes to mock behavior:

- `vi.clearAllMocks()`, `vi.resetAllMocks()`, and `vi.restoreAllMocks()` now also clear/reset/restore **module-level mocks** created via `vi.mock()`. In earlier versions only instance-level (`vi.spyOn`) mocks were affected.
- If `vi.mock()` factories return `vi.fn()` created inline (e.g. `() => ({ exec: vi.fn() })`), those instances are recreated on each reset, severing the reference stored in test-file variables like `const mockExec = exec`.
- The fix is `vi.hoisted()`: declare shared `vi.fn()` instances there, then reference them in both the factory and the test body. The `vi.hoisted()` callback runs before the hoisted `vi.mock()` factories, so the same instance is always used.
- When mocking a module whose functions are captured via `promisify()` (or any closure), the mock must use `vi.hoisted()` so the promisified wrapper always closes over the same `vi.fn()` instance, not a stale one from a previous factory run.
- Use `mfn.mockReset()` in `beforeEach` instead of `vi.clearAllMocks()` / `vi.resetAllMocks()` to avoid module-mock recreation.
- Read the Vitest 4 migration guide before writing or debugging tests: https://vitest.dev/guide/migration

## Naming Conventions

Always choose clear, unambiguous names. When something could be confused with another concept, add the disambiguating word rather than abbreviating. Examples:

- `isProdServer` not `isServe` (there is both a dev server and a prod server)
- `BASCIK_PROD_SERVER` not `BASCIK_SERVE` (the env var mirrors the concept)
- Prefer the full word over a contraction when the shorter form is ambiguous in context

## TypeScript Type Checking

```sh
npx --prefix pkg tsc -p pkg/tsconfig.json --noEmit
```

`create/`, `docs/`, and `extensions/vscode-bascik/` have their own tsconfigs; check them when editing files in those packages:

```sh
npx --prefix create tsc -p create/tsconfig.json --noEmit
npx --prefix pkg tsc -p docs/tsconfig.json --noEmit
npx --prefix extensions/vscode-bascik tsc -p extensions/vscode-bascik/tsconfig.json --noEmit
```

(`docs/` does not have its own typescript package, so use `pkg`'s tsc for it.)

Fix all errors before finishing. Do not suppress errors with `// @ts-ignore` or `as any` when a proper type fix is straightforward.
