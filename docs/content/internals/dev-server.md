# Dev Server

Bascik's development server is a TLS-enabled HTTP/2 server built on Node.js built-ins. It serves transpiled pages from an in-memory store, static assets from disk, and broadcasts live-reload events via Server-Sent Events.

## Why HTTP/2?

HTTP/2 requires TLS. Using it for development means the protocol between the dev server and the browser matches production deployments on modern static hosts, eliminating a class of "works in dev, breaks in prod" issues around protocol-level behaviour. It also means no special handling is needed for assets that load over HTTP/2 in production.

## TLS Certificate Generation (`pki.ts`)

On first run, Bascik generates a self-signed certificate valid for 100 years and writes two files to the project root:

- `bascik-cert.pem`: the certificate
- `bascik-privkey.pem`: the private key

On subsequent runs, both files are checked for existence and generation is skipped if they are present. The generation strategy differs by platform:

- **macOS / Linux:** a single `openssl req` command generates both files, including a `subjectAltName` extension for `localhost` and `127.0.0.1`.
- **Windows:** PowerShell's `New-SelfSignedCertificate` creates the cert in the Windows certificate store, then OpenSSL extracts the PEM files from a temporary PFX export.

Because the cert is self-signed, browsers will show a security warning on first visit. Trust the cert once in the browser and the warning will not reappear.

<div class="callout">
<p>These files are generated per-project, not globally. If you delete them, they are regenerated on the next <code>bascik</code> invocation.</p>
</div>

## The HTTP/2 Server (`http2.ts`)

The server starts binding its port concurrently with page transpilation. `serveHttp2()` returns the origin URL once the port is bound; `transpile.ts` prints `Server running at …` immediately after the transpilation summary line, with no gap between them.

The server listens on `https://localhost:8443` and handles all requests on a single `"stream"` event handler. Only `GET` requests are accepted; all other methods receive a `405 Method Not Allowed` response.

### Request routing

Requests are dispatched in this order:

1. **Live-reload SSE endpoint.** `GET /bascik-live-reload`: sets up a Server-Sent Events stream. When the watch system detects a change, it sends `data: reload\n\n` to all connected clients, which calls `window.location.reload()`.
2. **Static assets with extensions.** Any path with a file extension other than `.html` is served directly from the `dist/` directory using a streaming `createReadStream`. The correct `Content-Type` is set from the `MIME_MAP`.
3. **HTML pages.** Paths without a file extension are looked up in the in-memory store. If found, the page is served with brotli compression if the client accepts it (`Accept-Encoding: br`), otherwise the raw buffer is sent. Unknown paths fall back to the `/404` entry if one exists.

### Why in-memory beats streaming for HTML pages

Static assets (CSS, JS, images) are served with `createReadStream().pipe(stream)` because they live on disk and streaming avoids loading them into memory twice. HTML pages work differently: every page is already fully materialized as a `Buffer` in `MemoryStore` from the moment it finishes transpiling. For an in-memory buffer there is no I/O to pipeline; the bottleneck that streaming exists to solve is absent. Sending the buffer directly with `stream.end(buf)` is a single syscall into the HTTP/2 framer, whereas piping through a `Readable` adds queue overhead for no gain. Pre-compressed brotli buffers follow the same pattern: `stream.end(page.compressedContent)` avoids per-request compression entirely.

### Boot page during initial startup

The dev server binds its port concurrently with page transpilation. Any request that arrives before a page has been stored in `mem` would otherwise return a bare 404. Instead, Bascik serves a lightweight boot page: a spinner with a short "Building site..." label. The page carries no framework or external resources.

The boot page connects to the normal `/bascik-live-reload` SSE endpoint. Because the Referer header contains the originally requested URL, the SSE handler tracks it the same way it tracks any open page. When that specific page finishes transpiling, the `"transpiled"` event fires and the SSE connection sends `reload`; the browser fetches the real page immediately without waiting for the rest of the project to finish. As a belt-and-suspenders measure, a `"boot-done"` event is emitted on the shared event emitter once `watchFiles()` resolves, which flushes any remaining boot-page connections (for example, a request to a path that does not exist yet). If the SSE connection itself fails before the page is ready, an `onerror` handler retries with a one-second `setTimeout`.

The `isBooting` flag in `mem.ts` is set to `true` on module load and cleared (alongside the `"boot-done"` event) by `transpile.ts` immediately after `watchFiles()` resolves. Once the flag is cleared, unmatched paths fall through to the normal 404 path. The boot page is never served in `--serve` (production) mode.

### Error handling



The server registers `process.once` handlers for `SIGTERM` and `SIGINT`. On either signal it calls `server.close()` to stop accepting new connections, then immediately destroys all tracked HTTP/2 sessions. Destroying sessions closes the live-reload SSE stream (which would otherwise hold the process open indefinitely), so the process exits cleanly as soon as in-flight requests finish. A 10-second safety timeout force-exits if anything still hasn’t drained.

## In-Memory Page Store (`mem.ts`)

The `MemoryStore` class holds two maps and one set:

- `#files`: maps HTTP paths (e.g. `/getting-started`) to `StoredPage` objects containing the raw buffer, a brotli-compressed buffer, and the set of component names used on that page.
- `#components`: an inverted index mapping each component name to the `Set<string>` of absolute page file paths that use it.
- `#openPages`: the set of HTTP paths that currently have an active SSE live-reload connection (i.e. a browser tab is open on that page).

This inverted index powers selective re-transpilation. When a component file changes, `selectivelyProcessPages` looks up exactly which pages need rebuilding without scanning every page in the project.

### Open-page priority

When a file change triggers a full re-transpile of all pages (e.g. a file in `directory.watch` changed), Bascik uses the `#openPages` set to sort the page list so currently-open pages are transpiled first. Those pages emit the `"transpiled"` event before the rest of the batch, which means the browser live-reload fires as soon as the visible page is ready rather than waiting for all pages to finish.

The tracking lifecycle:
1. An SSE connection opens at `/bascik-live-reload`; the server parses the `Referer` header and calls `mem.trackOpenPage(path)`.
2. The SSE stream closes (tab navigates away, browser closes); the server calls `mem.untrackOpenPage(path)`.
3. `partitionByOpenPages` in `processing.ts` splits any page list into `[openPages, rest]` and the caller awaits open pages first.

### Brotli compression

Pages are brotli-compressed asynchronously (`zlib.brotliCompress`) when stored. All in-flight compression calls for a given batch of pages run concurrently via `Promise.all`, so startup cost scales with the slowest single page rather than the sum. The compressed buffer is served pre-compressed when the client sends `Accept-Encoding: br`, avoiding per-request compression.

## Watch System (`watch.ts`)

Three separate chokidar watchers are started by `watchFiles()`. All watchers use polling mode (`usePolling: true`) to avoid hitting OS file-descriptor limits on large projects.

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
  const eventSource = new EventSource("/bascik-live-reload");
  eventSource.onmessage = function(event) {
    if (event.data === 'reload') {
      window.location.reload();
    }
  };
  eventSource.onerror = function() {
    eventSource.close();
    console.warn('Live-Reload Connection Lost');
  };
  window.onbeforeunload = function () { eventSource.close(); };
})();
```

This script is only present in dev mode. The build pipeline does not inject it during production builds.

## Build Mode Differences

When `--build` is passed (or `BASCIK_BUILD=1` is set), the server is never started. The watch system still runs, but in non-persistent mode so chokidar exits after processing all initial file events. The live-reload script is not injected.
