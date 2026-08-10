<p class="section-label">Internals</p>

# Architecture

<p class="page-intro">Bascik is a Node.js CLI tool written in TypeScript. Its source lives entirely in <code>pkg/src/</code>. This page maps every module to its responsibility and explains how they fit together.</p>

## Entry Point

`pkg/src/transpile.ts` is the CLI entry point, declared as the `bascik` bin in `package.json`. It does three things:

1. Calls `watchFiles()` — starts chokidar file watchers that kick off transpilation whenever a page or component changes.
2. In dev mode, generates a self-signed TLS certificate if one does not already exist.
3. In dev mode, imports and starts the HTTP/2 development server.

```ts
// transpile.ts (entry point)
if (process.argv.includes("--check")) {
  const { checkProject } = await import("./lib/check.js");
  const ok = await checkProject();
  process.exit(ok ? 0 : 1);
}

watchFiles();

if (!BascikConfig.isBuild) {
  await createSelfSignedCert();
  const { serveHttp2 } = await import("./lib/http2.js");
  serveHttp2();
}
```

The dynamic `import()` calls for `check.js` and `http2.js` are intentional — they avoid loading those modules when not needed (`--check` exits immediately after analysis; `--build` never starts the server).

## Library Modules

All logic lives in `pkg/src/lib/`. Each file has a single, well-defined responsibility:

| Module | Responsibility |
|--------|----------------|
| `config.ts` | Loads and merges `bascik.config.js`, default config, and build overrides into a single frozen `BascikConfig` object consumed everywhere else. |
| `userConfig.ts` | Dynamically imports the user's `bascik.config.js` from `process.cwd()`, exporting `bascikConfig` and `buildOverrideConfig`. |
| `processing.ts` | The core transpilation pipeline. Contains `pageProcessing` (page phase) and `recursivelyTranspile` (component phase), plus pipeline utility types. |
| `components.ts` | Loads component HTML and CSS files from disk, detects component tags in HTML strings, extracts props/slots/attributes, and injects resolved content back. |
| `javascript.ts` | The scoping transforms: `prefixElementAttribute` (rewrites HTML attributes, JS DOM selectors, and CSS) and `namespaceScriptTags` (wraps scripts in IIFEs). |
| `styles.ts` | All CSS transformations: element selector conversion, class prefixing, `@keyframes` / `@layer` / container scoping, custom property prefixing, CSS deduplication. |
| `names.ts` | Generates unique instance IDs (`getUniqueId`) and hashes long scoped names to short hex strings (`obfuscateAttributeName` via SHAKE-256) when obfuscation is enabled. |
| `build-scripts.ts` | Executes `<script data-bascik-build>` blocks as Node.js ESM modules at transpile time and replaces the tag with the script's stdout output. |
| `check.ts` | Static analysis for `bascik --check`. Scans all pages and components for unresolved custom tags (errors) and unused component files (warnings). Exits with code 1 when errors are found so it can gate CI pipelines. |
| `watch.ts` | Sets up chokidar watchers for pages, components, and static assets. Triggers full or selective re-transpilation on file events. |
| `http2.ts` | The development HTTP/2 server on `https://localhost:8443`. Serves transpiled pages from the memory store, static assets from disk, and the live-reload SSE endpoint. |
| `mem.ts` | In-memory page store. Stores brotli-compressed page buffers keyed by HTTP path, and maintains a reverse index mapping each component name to the set of pages that use it. |
| `worker-pool.ts` | Generic fixed-size thread pool. Spawns N workers once, dispatches tasks via a queue, and reuses workers across calls to avoid per-task spawn overhead. |
| `page-worker.ts` | Worker thread entry point. Receives a page path, calls `transpilePage()` (pure computation, no side effects), and posts the result back to the pool. |
| `pki.ts` | Generates a self-signed TLS certificate (`bascik-cert.pem` / `bascik-privkey.pem`) via OpenSSL or PowerShell on Windows. |
| `file-system.ts` | File-system helpers: recursive directory listing, path resolution between source and dist, copying static assets. |
| `paths.ts` | Converts file-system paths to HTTP paths (stripping the `src/pages` prefix, removing `.html` extensions). |
| `events.ts` | A simple Node.js `EventEmitter` shared between the watch system, processing pipeline, and HTTP/2 server to signal live-reload events. |
| `mime.ts` | A static MIME type map used by the HTTP/2 server and the watch system's file-type filter. |
| `types.ts` | Central TypeScript type definitions: `BascikComponent`, `ComponentList`, `TranspileResult`, `TranspilePageResult`, `BascikConfigOptions`, `StoredPage`. |

## Dependency Graph

The data flow at a high level:

```text
transpile.ts
  ├── config.ts ← userConfig.ts ← bascik.config.js
  ├── (--check only)
  │     └── check.ts ← components.ts, file-system.ts
  ├── watch.ts
  │     └── processing.ts
  │           ├── components.ts ← file-system.ts
  │           ├── javascript.ts
  │           │     ├── styles.ts
  │           │     └── names.ts
  │           ├── styles.ts
  │           ├── build-scripts.ts
  │           ├── worker-pool.ts → page-worker.ts
  │           │     └── (transpilePage — no side effects)
  │           ├── mem.ts ← paths.ts
  │           └── events.ts
  └── (dev only)
        ├── pki.ts
        └── http2.ts ← mem.ts, events.ts, paths.ts, mime.ts
```

## Key Design Decisions

### Frozen config singleton

`BascikConfig` is initialised once at startup via `config.ts` and frozen with `Object.freeze()`. Every module imports this singleton directly. There is no dependency injection — configuration is a module-level constant that is immutable at runtime.

### No runtime framework

Bascik has a single runtime dependency: [chokidar](https://github.com/paulmillr/chokidar) for file watching. Everything else uses Node.js built-ins (`node:fs`, `node:http2`, `node:crypto`, `node:zlib`). This keeps the install footprint minimal and eliminates version-conflict surface area for users.

### Regex-based HTML parsing

Bascik intentionally avoids DOM parsers (e.g. `htmlparser2`, `parse5`). Component tags are detected and replaced with targeted regular expressions. This is fast and has zero additional dependencies, but it means Bascik only supports a well-defined subset of HTML — particularly around self-closing tags and nested identical tags. The [Scoping Compatibility](/compatibility) page documents the known limitations.

### TypeScript compiled to ESM

The package ships as native ESM (`"type": "module"` in `package.json`). TypeScript is compiled by `tsc` using `tsconfig.build.json` which targets `ES2023` and emits to `pkg/dist/`. The `tsconfig.json` (without the `.build` suffix) is used by Vitest and includes test files.

### CPU-aware worker pool (opt-in)

When `useWorkers: true` is set in `bascik.config.js` (default `false`), `processAllPages()` creates `Math.min(os.cpus().length, pageCount)` worker threads via `worker-pool.ts` instead of transpiling sequentially on the main thread. Each worker is initialised once with the pre-computed `componentList` and `globalStylesHtml`, then reused for every page assigned to it. The main thread dispatches page paths through the pool's task queue and collects results to apply side effects (memory storage, event emission) after all workers complete.

Spinning up the pool has a fixed cost — each worker loads the transpiler's module graph independently before it can process its first page. This pays for itself on larger sites with CPU-heavy per-page work, but for small sites (or sites whose slow parts are I/O-bound, like `<script data-bascik-build>` blocks) sequential transpilation on the main thread is often faster overall. See the [`useWorkers`](/configuration#useworkers) config option.

### Memory-first dev serving

In dev mode, `pageProcessing()` writes the transpiled HTML to the in-memory store and emits the `"transpiled"` event before writing anything to disk. The HTTP/2 server can serve the updated page immediately. Disk writes are skipped entirely in dev — `dist/` is only written during `--build`.
