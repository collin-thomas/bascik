# VS Code Extension

The extension adds two things to the editor: component tag navigation (command-click a custom tag to jump to its source file) and unsupported pattern diagnostics (warnings for CSS and JS patterns that Bascik's scoping engine cannot handle safely).

The warning set is generated from the [Scoping Compatibility](/compatibility) matrix. A generation step reads the rule metadata from that doc and writes `extensions/vscode-bascik/src/compatibility-rules.json` before the extension compiles, so the editor warnings stay in sync with the compatibility table automatically.

The extension lives in `extensions/vscode-bascik/` as its own package rather than inside `pkg/` to keep the transpiler focused on build-time logic.

## Features

### Component tag navigation

The extension scans the workspace for component files under `src/components` and resolves the corresponding tag name to the component file. When the cursor is on a custom tag, command-click opens the component source file.

### Unsupported pattern diagnostics

The extension warns on common unsupported or brittle cases such as:

- `[id]` and other attribute selectors in CSS
- `:is(p, h2)`-style element selectors inside pseudo-class arguments
- unsafe runtime JavaScript patterns such as `element.id = ...` or template-literal class assignment

The warnings are intentionally high-signal. They are meant to prevent silent behavior drift, not to replicate a full linter.

## Implementation shape

The prototype extension uses:

- the VS Code `DefinitionProvider` API for component tag navigation
- the `DiagnosticCollection` API for warnings in HTML, CSS, and JS files
- a workspace scan of `src/components` to build a component-name to file map

## Developing locally

The extension compiles independently from the rest of the monorepo.

```sh
cd extensions/vscode-bascik
npm run compile        # generates compatibility-rules.json then runs tsc
npm run watch          # recompiles on save
```

The `precompile` script runs `docs/scripts/generate-compatibility-rules.ts` first, so `src/compatibility-rules.json` is always regenerated from the docs before the TypeScript compiles.

To launch a VS Code Extension Development Host with the extension loaded, open `extensions/vscode-bascik/` as the workspace root in VS Code and press F5 (uses the `Run Extension` launch config in `.vscode/launch.json`).

## Publishing to the VS Code Marketplace

The full publishing steps, pre-publish checklist, and version-bump workflow are documented in [`extensions/vscode-bascik/README.md`](https://github.com/collin-bascik/bascik/blob/main/extensions/vscode-bascik/README.md).

In short: add a `publisher` field to `package.json`, install `@vscode/vsce`, run `npm run compile && vsce package` to produce a `.vsix`, verify it locally, then run `vsce publish` with a Marketplace PAT.
