# Bascik VS Code Extension

Editor companion for [Bascik](https://bascik.dev) projects. Provides component tag navigation and scoping compatibility warnings.

## Features

- **Component navigation** — command-click a custom tag (e.g. `<my-card>`) to jump to the matching component file in `src/components`.
- **Scoping diagnostics** — warns on CSS selectors and JavaScript patterns that Bascik's scoping engine cannot handle safely. The warning set is generated from the [Scoping Compatibility](https://bascik.dev/compatibility) matrix and stays in sync automatically.

## Local development

```sh
cd extensions/vscode-bascik
npm run compile   # generates compatibility-rules.json then runs tsc
npm run watch     # recompiles on save
```

Open `extensions/vscode-bascik/` as the workspace root in VS Code and press **F5** to launch an Extension Development Host with the extension loaded.

## Publishing to the VS Code Marketplace

### Prerequisites

1. Create a publisher on the [Visual Studio Marketplace publisher management page](https://marketplace.visualstudio.com/manage).
2. Generate a Personal Access Token (PAT) in Azure DevOps with the **Marketplace (Manage)** scope.
3. Install `vsce`:

   ```sh
   npm install -g @vscode/vsce
   ```

### First-time setup

Add a `publisher` field to `package.json` matching the publisher name you created:

```json
"publisher": "your-publisher-name"
```

### Package and publish

Build the extension and create a `.vsix` bundle:

```sh
cd extensions/vscode-bascik
npm run compile
vsce package
```

This produces a file like `bascik-vscode-0.1.0.vsix`. Inspect it locally before publishing:

```sh
code --install-extension bascik-vscode-0.1.0.vsix
```

When ready, publish:

```sh
vsce publish
```

`vsce` will prompt for your PAT on the first run. To skip the prompt, pass it directly:

```sh
vsce publish --pat <your-pat>
```

### Bumping the version

Update `version` in `package.json` before each release. `vsce publish` also accepts a version bump shorthand:

```sh
vsce publish patch   # 0.1.0 → 0.1.1
vsce publish minor   # 0.1.0 → 0.2.0
vsce publish major   # 0.1.0 → 1.0.0
```

This writes the new version back to `package.json` and tags the release.

### Pre-publish checklist

- [ ] `compatibility-rules.json` is current (`npm run compile` regenerates it)
- [ ] `version` in `package.json` is bumped
- [ ] `publisher` field is set in `package.json`
- [ ] `.vsix` installs and works correctly in a clean VS Code window
