# Dev Server

Bascik's development server serves transpiled pages from an in-memory store, static assets from disk, and broadcasts live-reload events via Server-Sent Events. By default, it runs over plaintext HTTP/1.1 for zero-friction local development, with opt-in support for TLS-enabled HTTP/2.

## Server Architecture (`server.ts`, `http.ts`, `http2.ts`)

Bascik separates protocol setup from request routing using a modular 4-tier design:

```text
       [transpile.ts / serve.ts]
                  │
                  ▼ (startServer)
         [server.ts Orchestrator]
                  │
         ┌────────┴────────┐
         │ (enableTls:     │ (enableTls:
         │  false)         │  true)
         ▼                 ▼
     [http.ts]          [pki.ts Cert Gen]
  (HTTP/1.1 Server)        │
         │                 ▼
         │             [http2.ts]
         │          (HTTP/2 Server)
         │                 │
         └────────┬────────┘
                  ▼
   [server.ts: createRequestHandler]
                  │
                  ▼ (Serves HTML & static files)
     [mem.ts / dist/ directory]
```

1. **`server.ts`**: The central server orchestrator. It contains the unified `createRequestHandler()` pipeline and `startServerInstance()` port binder, plus the top-level `startServer()` dispatcher.
2. **`http.ts`**: Standard unencrypted HTTP/1.1 server (`node:http`). Wraps `http.IncomingMessage` / `http.ServerResponse` into Bascik's request context.
3. **`http2.ts`**: Opt-in encrypted HTTP/2 server (`node:http2`). Wraps `ServerHttp2Stream` into Bascik's request context.
4. **`pki.ts`**: Generates self-signed TLS certificates when `enableTls: true` is set and certificate files do not exist.

## Why Plaintext HTTP/1.1 by Default?

Plaintext HTTP/1.1 works everywhere without certificate warnings, browser bypass prompts, or platform trust setup. Browsers and local development tools (such as VS Code's integrated Simple Browser) connect instantly.

If you need production HTTP/2 protocol parity, enable TLS in `bascik.config.ts`:

```ts
export default {
  serve: {
    enableTls: true, // Dev server boots over https://localhost:8443 (HTTP/2)
  },
};
```

## TLS Certificate Generation (`pki.ts`)

When `enableTls: true` is configured, Bascik checks for local certificate files (`bascik-cert.pem` and `bascik-privkey.pem`). If missing, it attempts to generate CA-trusted certs via `mkcert` or falls back to OpenSSL self-signed certs.

On subsequent runs, both files are checked for existence and generation is skipped if they are present.

<div class="callout">
<p>These files are generated per-project, not globally. If you delete them, they are regenerated on the next <code>bascik</code> invocation when TLS is enabled.</p>
</div>

### Request routing

Requests are dispatched in this order:

1. **Live-reload SSE endpoint.** `GET /bascik-live-reload`: sets up a Server-Sent Events stream. When the watch system detects a change, it sends `data: reload\n\n` to all connected clients, which calls `window.location.reload()`.
2. **Static assets with extensions.** Any path with a file extension other than `.html` is served directly from the `dist/` directory using a streaming `createReadStream`. The correct `Content-Type` is set from the `MIME_MAP`.
3. **HTML pages.** Paths without a file extension are looked up in the in-memory store. If found, the page is served with brotli compression if the client accepts it (`Accept-Encoding: br`), otherwise the raw buffer is sent. Unknown paths fall back to the `/404` entry if one exists.

### Why in-memory beats streaming for HTML pages

Static assets (CSS, JS, images) are served with `createReadStream().pipe(stream)` because they live on disk and streaming avoids loading them into memory twice. HTML pages work differently: every page is already fully materialized as a `Buffer` in `MemoryStore` from the moment it finishes transpiling. For an in-memory buffer there is no I/O to pipeline; the bottleneck that streaming exists to solve is absent. Sending the buffer directly with `stream.end(buf)` is a single syscall into the HTTP/2 framer, whereas piping through a `Readable` adds queue overhead for no gain. Pre-compressed brotli buffers follow the same pattern: `stream.end(page.compressedContent)` avoids per-request compression entirely.

### Boot page during initial startup

The dev server binds its port concurrently with page transpilation. Any request that arrives before a page has been stored in `mem` would otherwise return a bare 404. Instead, Bascik serves a lightweight boot page: a spinner with a short "Building site..." label. The page carries no framework or external resources.

The boot page connects to the normal `/bascik-live-reload` SSE endpoint. Because the Referer header contains the originally requested URL, the SSE handler tracks it the same way it tracks any open page. When that specific page finishes transpiling, the `"transpiled"` event fires and the SSE connection sends `reload`; the browser fetches the real page immediately without waiting for the rest of the project to finish. As a belt-and-suspenders measure, a `"boot-done"` event is emitted on the shared event emitter once `watchFiles()` resolves, which flushes any remaining boot-page connections (for example, a request to a path that does not exist yet). If the SSE connection itself fails before the page is ready, the `onerror` handler closes the stream and sets it to null, relying on the `focus` and `visibilitychange` listeners to reconnect instantly as soon as the user interacts with or switches back to the tab.

The `isBooting` flag in `mem.ts` is set to `true` on module load and cleared (alongside the `"boot-done"` event) by `transpile.ts` immediately after `watchFiles()` resolves. Once the flag is cleared, unmatched paths fall through to the normal 404 path. The boot page is never served in `--serve` (production) mode.

### Graceful shutdown

The server registers `process.once` handlers for `SIGTERM` and `SIGINT`. On either signal it stops accepting new connections, destroys all tracked HTTP/2 sessions and their underlying sockets, closes all chokidar watchers, and exits immediately (`process.exit(0)`). Destroying sessions closes the live-reload SSE stream (which would otherwise hold the process open indefinitely), so the process exits cleanly without delay.

## In-Memory Page Store (`mem.ts`)

The `MemoryStore` class holds two maps and one set:

- `#files`: maps HTTP paths (e.g. `/getting-started`) to `StoredPage` objects containing the raw buffer, a brotli-compressed buffer, and the set of component names used on that page.
- `#components`: an inverted index mapping each component name to the `Set<string>` of absolute page file paths that use it.
- `#openPages`: the set of HTTP paths that currently have an active SSE live-reload connection (i.e. a browser tab is open on that page).

This inverted index powers selective re-transpilation. When a component file changes, `selectivelyProcessPages` looks up exactly which pages need rebuilding without scanning every page in the project.

### Open-page priority

When a file change triggers a full re-transpile of all pages (e.g. a file in `watch` changed), Bascik uses the `#openPages` set to sort the page list so currently-open pages are transpiled first. Those pages emit the `"transpiled"` event before the rest of the batch, which means the browser live-reload fires as soon as the visible page is ready rather than waiting for all pages to finish.

The tracking lifecycle:
1. An SSE connection opens at `/bascik-live-reload`; the server parses the `Referer` header and calls `mem.trackOpenPage(path)`.
2. The SSE stream closes (tab navigates away, browser closes); the server calls `mem.untrackOpenPage(path)`.
3. `partitionByOpenPages` in `processing.ts` splits any page list into `[openPages, rest]` and the caller awaits open pages first.

### Brotli compression

Pages are brotli-compressed asynchronously (`zlib.brotliCompress`) when stored in memory. In development mode, compression uses minimum quality (`BROTLI_MIN_QUALITY = 1`) so background compression is instantaneous and avoids queuing heavy C++ threadpool tasks that could delay process exit. In production builds, maximum quality (`BROTLI_MAX_QUALITY = 11`) is used. The compressed buffer is served pre-compressed when the client sends `Accept-Encoding: br`, avoiding per-request compression.

## Watch System (`watch.ts`)

Three separate chokidar watchers are started by `watchFiles()`. All watchers use native OS file system events for fast, efficient file-change detection.

### Watcher 1: Static assets

Watches the pages directory for any file matching the MIME map. On `add` or `change`, the file is copied to the mirrored path in `dist/`. On `unlink`, the dist file is deleted. In dev mode, a change also emits an `"asset-changed"` event to trigger live reload.

### Watcher 2: Page HTML files

Watches the pages directory for `.html` files only. On the initial `"ready"` event, `processAllPages()` is called, this pre-computes the component list once, then transpiles all pages sequentially on the main thread by default, or across a CPU-aware worker pool if `useWorkers: true` is configured. After the initial scan, individual `add` or `change` events call `pageProcessing(path)` for that file alone.

On `unlink`, the page is removed from the memory store and deleted from `dist/`.

### Watcher 3: Component files

Watches the components directory for `.html` and `.css` files. Uses `ignoreInitial: true` so it only fires on changes after startup.

- **add:** a new component was created; `processAllPages()` is called to rebuild everything using the updated component list.
- **change / unlink:** `selectivelyProcessPages(path)` uses the inverted component index to rebuild only affected pages.

## Live Reload

The live-reload mechanism uses Server-Sent Events (SSE) rather than WebSockets to avoid the complexity of a bidirectional protocol for a unidirectional (server-to-browser) use case. The injected client script:

```js
(function() {
  var wasConnected = false;
  var source;
  function connect() {
    if (source) return;
    source = new EventSource("/bascik-live-reload");
    source.onmessage = function(e) {
      if (e.data === 'reload') {
        window.location.reload();
      } else if (e.data === 'connected') {
        if (wasConnected) {
          window.location.reload();
        }
        wasConnected = true;
      }
    };
    source.onerror = function() {
      source.close();
      source = null;
    };
  }
  function instantConnect() {
    if (!source) {
      connect();
    }
  }
  window.addEventListener('focus', instantConnect);
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') instantConnect();
  });
  window.addEventListener('beforeunload', function() { if (source) source.close(); });
  connect();
})();
```

This script is only present in dev mode. The build pipeline does not inject it during production builds.

## Build Mode Differences

When `--build` is passed (or `BASCIK_BUILD=1` is set), the server is never started. The watch system still runs, but in non-persistent mode so chokidar exits after processing all initial file events. The live-reload script is not injected.
