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

### Error handling

Stream-level errors (client disconnects, runtime bugs per page) are caught by an `onError` helper that responds with `404` for missing files or `500` for other errors, then closes the stream. Server-level errors (TLS config, binding failures) are caught by `server.on("error")`.

### Graceful shutdown

The server registers `process.once` handlers for `SIGTERM` and `SIGINT`. On either signal it calls `server.close()` to stop accepting new connections, then immediately destroys all tracked HTTP/2 sessions. Destroying sessions closes the live-reload SSE stream (which would otherwise hold the process open indefinitely), so the process exits cleanly as soon as in-flight requests finish. A 10-second safety timeout force-exits if anything still hasn’t drained.

## In-Memory Page Store (`mem.ts`)

The `MemoryStore` class holds two maps:

- `#files`: maps HTTP paths (e.g. `/getting-started`) to `StoredPage` objects containing the raw buffer, a brotli-compressed buffer, and the set of component names used on that page.
- `#components`: an inverted index mapping each component name to the `Set<string>` of absolute page file paths that use it.

This inverted index powers selective re-transpilation. When a component file changes, `selectivelyProcessPages` looks up exactly which pages need rebuilding without scanning every page in the project.

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
