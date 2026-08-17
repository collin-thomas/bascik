import { readFile, access, stat } from "node:fs/promises";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);
import { extname, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import http2 from "node:http2";
import type { ServerHttp2Stream, IncomingHttpHeaders } from "node:http2";
import http from "node:http";
import { mem } from "./mem.js";
import { BascikConfig, shouldLog } from "./config.js";
import { eventEmitter, runShutdownHandlers } from "./events.js";
import { getHttpPath } from "./paths.js";
import { MIME_MAP } from "./mime.js";
import { createReadStream } from "node:fs";
import { executeServerScripts, DEFAULT_SCRIPT_TIMEOUT_MS } from "./server-scripts.js";
import { BOOT_PAGE_HTML } from "./boot-page.js";

// ─── Security headers sent on every response ──────────────────────────────────
const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "interest-cohort=()",
};

// Strong ETag from a content buffer
const makeEtag = (buf: Buffer): string =>
  `"${createHash("sha1").update(buf).digest("base64url").slice(0, 27)}"`;

// Weak stat-based ETag for static files — no extra file read needed
const makeStatEtag = (mtimeMs: number, size: number): string =>
  `W/"${mtimeMs.toString(36)}-${size.toString(36)}"`;

// ─── Per-IP rate limiting ─────────────────────────────────────────────────────
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_REQUESTS = 500;

interface RateEntry { count: number; windowStart: number; }

/** Exported for test cleanup only — do not use in production code. */
export const _rateLimiter = new Map<string, RateEntry>();

const isRateLimited = (ip: string): boolean => {
  const now = Date.now();
  const entry = _rateLimiter.get(ip);
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    _rateLimiter.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_MAX_REQUESTS;
};

// Purge stale entries to prevent unbounded memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of _rateLimiter) {
    if (now - entry.windowStart >= RATE_WINDOW_MS) _rateLimiter.delete(ip);
  }
}, RATE_WINDOW_MS).unref();

export interface BascikRequest {
  method: string;
  path?: string;
  headers: Record<string, string | string[] | undefined>;
  remoteIp: string;
}

export interface BascikResponse {
  headersSent: boolean;
  destroyed: boolean;
  writable: NodeJS.WritableStream;
  respond(status: number, headers: Record<string, string | number>): void;
  write(chunk: string | Buffer): boolean;
  end(chunk?: string | Buffer): void;
  close(code?: number): void;
  on(event: "close", cb: () => void): void;
}

const adaptHttp2 = (stream: ServerHttp2Stream, headers: IncomingHttpHeaders): { req: BascikRequest; res: BascikResponse } => {
  let remoteIp = "unknown";
  try {
    remoteIp = (stream as any).session?.socket?.remoteAddress ?? "unknown";
  } catch { }

  const req: BascikRequest = {
    method: headers[":method"] as string ?? "GET",
    path: headers[":path"] as string,
    headers: headers as Record<string, string | string[] | undefined>,
    remoteIp,
  };

  const res: BascikResponse = {
    get headersSent() { return stream.headersSent; },
    get destroyed() { return stream.destroyed; },
    writable: stream,
    respond(status, headers) {
      const respHeaders: Record<string, string | number> = { ...headers };
      if (":status" in respHeaders) {
        delete respHeaders[":status"];
      }
      stream.respond({ ":status": status, ...respHeaders });
    },
    write(chunk) { return stream.write(chunk); },
    end(chunk) {
      if (arguments.length === 0) {
        stream.end();
      } else {
        stream.end(chunk);
      }
    },
    close(code) { stream.close(code); },
    on(event, cb) { stream.on(event, cb); },
  };

  return { req, res };
};

const adaptHttp1 = (reqMsg: http.IncomingMessage, resMsg: http.ServerResponse): { req: BascikRequest; res: BascikResponse } => {
  const req: BascikRequest = {
    method: reqMsg.method ?? "GET",
    path: reqMsg.url,
    headers: reqMsg.headers,
    remoteIp: reqMsg.socket.remoteAddress ?? "unknown",
  };

  const res: BascikResponse = {
    get headersSent() { return resMsg.headersSent; },
    get destroyed() { return resMsg.destroyed; },
    writable: resMsg,
    respond(status, headers) {
      const respHeaders: Record<string, any> = { ...headers };
      if (":status" in respHeaders) {
        delete respHeaders[":status"];
      }
      resMsg.writeHead(status, respHeaders);
    },
    write(chunk) { return resMsg.write(chunk); },
    end(chunk) {
      if (arguments.length === 0) {
        resMsg.end();
      } else {
        resMsg.end(chunk);
      }
    },
    close() { resMsg.destroy(); },
    on(event, cb) { resMsg.on(event, cb); },
  };

  return { req, res };
};

export const startHttp2Server = async () => {
  const hostname = BascikConfig.serve?.hostname ?? "localhost";
  const startPort = BascikConfig.serve?.port ?? 8443;
  const distDir = resolve(process.cwd(), "dist");
  let origin = "";

  const disableTls = !!BascikConfig.serve?.disableTls;
  let server: http2.Http2SecureServer | http.Server;

  if (disableTls) {
    server = http.createServer();
  } else {
    const usingCustomCerts = !!(BascikConfig.serve?.keyFile || BascikConfig.serve?.certFile);
    const keyPath = resolve(process.cwd(), BascikConfig.serve?.keyFile ?? "bascik-privkey.pem");
    const certPath = resolve(process.cwd(), BascikConfig.serve?.certFile ?? "bascik-cert.pem");

    // Auto-generate certs if they don't exist yet.
    // mkcert produces a CA-trusted cert (no browser warning).
    // openssl is the self-signed fallback (browser will warn).
    // Custom certificate paths must already exist — Bascik will not overwrite them.
    const certsPresent = await Promise.all([access(keyPath), access(certPath)])
      .then(() => true)
      .catch(() => false);

    if (!certsPresent) {
      if (usingCustomCerts) {
        throw new Error(
          "Custom TLS certificate files are configured but could not be found.\n" +
          `  keyFile:  ${keyPath}\n` +
          `  certFile: ${certPath}\n` +
          "Ensure both files exist before starting the server.",
        );
      }
      // Augment PATH so mkcert is found even when launched from VS Code or
      // other environments that don't source the user's shell profile.
      const env = {
        ...process.env,
        PATH: [
          process.env.PATH,
          "/opt/homebrew/bin",   // Apple Silicon Homebrew
          "/usr/local/bin",      // Intel Homebrew / manual installs
        ].filter(Boolean).join(":"),
      };

      try {
        await execFile("mkcert", [
          "-key-file", keyPath,
          "-cert-file", certPath,
          "localhost", "127.0.0.1", "::1",
        ], { env });
        console.log("SSL: generated trusted certs via mkcert (run `mkcert -install` once if you haven't)");
      } catch (mkcertErr) {
        console.log(`SSL: mkcert not found or failed (${(mkcertErr as Error).message?.split("\n")[0]}), falling back to openssl`);
        try {
          await execFile("openssl", [
            "req", "-x509", "-newkey", "rsa:2048",
            "-keyout", keyPath,
            "-out", certPath,
            "-days", "365",
            "-nodes",
            "-subj", "/CN=localhost",
          ]);
          console.log("SSL: self-signed cert generated (install mkcert for no browser warning)");
        } catch {
          throw new Error(
            "Could not generate SSL certificates.\n" +
            "Install mkcert (recommended) or openssl, then restart the dev server.\n" +
            "  brew install mkcert && mkcert -install",
          );
        }
      }
    }

    const key = await readFile(keyPath);
    const cert = await readFile(certPath);

    server = http2.createSecureServer({
      key,
      cert,
      settings: { maxConcurrentStreams: 250 },
    });
  }

  /*
  ```
  | Error Type            | Use `server.on("error")` | Use `onError(err, stream)` |
  | --------------------- | ------------------------ | -------------------------- |
  | Server setup failures | x                        |                            |
  | TLS config issues     | x                        |                            |
  | Client disconnects    |                          | x                          |
  | Stream already closed |                          | x                          |
  | Runtime bugs per page |                          | x                          |
  ``` 
  */
  const isNetworkResetError = (err: unknown): boolean => {
    const code = (err as NodeJS.ErrnoException)?.code;
    return (
      code === "ECONNRESET" ||
      code === "EPIPE" ||
      code === "ECANCELED" ||
      code === "ERR_HTTP2_STREAM_CANCEL" ||
      code === "ERR_HTTP2_INVALID_STREAM"
    );
  };

  const onError = (error: unknown, res: BascikResponse): void => {
    // Client disconnected mid-request — not a server bug, nothing to respond to.
    if (isNetworkResetError(error)) return;
    try {
      if (!res.headersSent) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          res.respond(404, { ...SECURITY_HEADERS });
        } else {
          res.respond(500, { ...SECURITY_HEADERS });
        }
      }
    } catch (respondErr) {
      console.error("Error responding to stream/request:", respondErr);
    }

    try {
      res.end();
    } catch (endErr) {
      console.error("Error ending stream/request:", endErr);
    }

    console.error("Request/Stream error:", error);
  };

  const openSessions = new Set<http2.ServerHttp2Session>();
  if (!disableTls) {
    (server as http2.Http2SecureServer).on("session", (session: http2.ServerHttp2Session) => {
      openSessions.add(session);
      session.once("close", () => openSessions.delete(session));
      // Prevent unhandled 'error' event crashes from protocol-level session errors.
      session.on("error", (err) => {
        if (isNetworkResetError(err)) return;
        console.error("[bascik] HTTP/2 session error:", err);
      });
    });
  }

  const handleRequest = async (req: BascikRequest, res: BascikResponse) => {
    const startMs = Date.now();
    let responseStatus = 0;

    const logAccess = () => {
      if (responseStatus === 0) return;
      const logging = BascikConfig.isProdServer
        ? (BascikConfig.serve?.logging ?? { level: "info", requests: true })
        : (BascikConfig.devServer?.logging ?? { level: "info", requests: true });
      if (logging.requests === false) return;
      if (!shouldLog(logging.level ?? "info", "info")) return;
      const elapsed = Date.now() - startMs;
      const method = req.method;
      const path = req.path;
      // Skip noisy SSE keep-alive pings
      if (path === "/bascik-live-reload") return;
      console.log(`${method} ${path} ${responseStatus} ${elapsed}ms`);
    };

    try {
      // ── Rate limiting ────────────────────────────────────────────────────
      if (BascikConfig.isProdServer && isRateLimited(req.remoteIp)) {
        responseStatus = 429;
        res.respond(429, { "retry-after": String(RATE_WINDOW_MS / 1000), ...SECURITY_HEADERS });
        res.end("Too Many Requests");
        return;
      }

      // ── Method guard: GET and HEAD only ──────────────────────────────────
      const isHead = req.method === "HEAD";
      if (req.method !== "GET" && !isHead) {
        responseStatus = 405;
        res.respond(405, { "allow": "GET, HEAD", ...SECURITY_HEADERS });
        res.end("Method Not Allowed");
        return;
      }

      if (!req.path) {
        responseStatus = 400;
        res.respond(400, { ...SECURITY_HEADERS });
        return res.end();
      }

      // Parse the request pathname once so routing decisions are never
      // confused by a query string (e.g. /style.css?v=1 or /search?email=a@b.com).
      const qIdx = req.path.indexOf("?");
      const pathname = qIdx === -1 ? req.path : req.path.slice(0, qIdx);

      // ── Static asset (has extension, not .html) ──────────────────────────
      const ext = extname(pathname).toLowerCase();
      if (ext && !ext.match(/^\.htm.*$/)) {
        // Path traversal guard: resolved path must stay inside dist/
        const safePath = pathname.slice(1); // strip leading /
        const fullPath = resolve(distDir, safePath);
        if (!fullPath.startsWith(distDir + sep)) {
          responseStatus = 400;
          res.respond(400, { ...SECURITY_HEADERS });
          res.end("Bad Request");
          return;
        }

        // Stat gives us size (for Content-Length) + mtime (for ETag) in one syscall.
        let fileStat: Awaited<ReturnType<typeof stat>>;
        try {
          fileStat = await stat(fullPath);
        } catch (err) {
          responseStatus = (err as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
          res.respond(responseStatus, { ...SECURITY_HEADERS });
          res.end(responseStatus === 404 ? "Not Found" : "Internal Server Error");
          return;
        }

        const etag = makeStatEtag(fileStat.mtimeMs, fileStat.size);
        if (BascikConfig.cacheHttp !== false && req.headers["if-none-match"] === etag) {
          responseStatus = 304;
          res.respond(304, { etag, ...SECURITY_HEADERS });
          res.end();
          return;
        }

        const staticHeaders: Record<string, string | number> = {
          "content-type": MIME_MAP.get(ext) ?? (MIME_MAP.get("octet-stream") as string),
          "content-length": fileStat.size,
          ...SECURITY_HEADERS,
        };
        if (BascikConfig.cacheHttp !== false) {
          staticHeaders["etag"] = etag;
          staticHeaders["cache-control"] = "public, max-age=3600";
        } else {
          staticHeaders["cache-control"] = "no-store";
        }

        if (isHead) {
          responseStatus = 200;
          res.respond(200, staticHeaders);
          res.end();
          return;
        }

        const fileStream = createReadStream(fullPath);

        fileStream.on("error", (err) => {
          if (res.destroyed) return;
          if (res.headersSent) {
            // Headers already went out on "open" — a second respond() would
            // throw ERR_HTTP2_HEADERS_SENT.  Abort the stream instead.
            res.close(http2.constants?.NGHTTP2_INTERNAL_ERROR);
            return;
          }
          responseStatus = (err as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
          res.respond(responseStatus, { ...SECURITY_HEADERS });
          res.end(responseStatus === 404 ? "Not Found" : "Internal Server Error");
        });

        fileStream.on("open", () => {
          if (res.destroyed) { fileStream.destroy(); return; }
          responseStatus = 200;
          res.respond(200, staticHeaders);
          fileStream.pipe(res.writable);
        });

        return;
      }

      // ── Reject dot-paths that are not file extensions (e.g. /img.dir/dog) ─
      if (pathname.split(".").length > 1) {
        responseStatus = 404;
        res.respond(404, { ...SECURITY_HEADERS });
        return res.end();
      }

      // ── Live-reload SSE ──────────────────────────────────────────────────
      if (pathname === "/bascik-live-reload") {
        // Disable in production serve mode.
        if (BascikConfig.isProdServer) {
          responseStatus = 404;
          res.respond(404, { ...SECURITY_HEADERS });
          return res.end();
        }

        const isBootReloadConnection = new URL(req.path, origin).searchParams.get("boot") === "1";

        responseStatus = 200;
        res.respond(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          ...SECURITY_HEADERS,
        });

        res.write(`data: connected\n\n`);

        // Parse the referer once at connection time for path-matching and open-page tracking.
        let openPagePath: string | null = null;
        try {
          if (req.headers.referer) openPagePath = new URL(req.headers.referer as string).pathname;
        } catch { }
        if (openPagePath) mem.trackOpenPage(openPagePath);

        const eventHandler = ({
          relativePagePath,
        }: {
          relativePagePath: string;
        }) => {
          if (res.destroyed) return;
          if (openPagePath) {
            const httpPath = getHttpPath(relativePagePath);
            // Normalize trailing slashes: browsers may omit the trailing slash on index routes.
            const strip = (p: string) => p.replace(/\/$/, "") || "/";
            if (strip(openPagePath) !== strip(httpPath)) return;
          }
          res.write(`data: reload\n\n`);
        };

        const assetChangedHandler = () => {
          if (res.destroyed) return;
          res.write(`data: reload\n\n`);
        };

        // Reload boot pages immediately when the initial scan finishes.
        const bootDoneHandler = () => { if (res.destroyed) return; res.write(`data: reload\n\n`); };

        eventEmitter.on("transpiled", eventHandler);
        eventEmitter.on("asset-changed", assetChangedHandler);
        eventEmitter.on("boot-done", bootDoneHandler);

        if (isBootReloadConnection && !mem.isBooting && !res.destroyed) {
          res.write(`data: reload\n\n`);
        }

        res.on("close", () => {
          if (openPagePath) mem.untrackOpenPage(openPagePath);
          eventEmitter.removeListener("transpiled", eventHandler);
          eventEmitter.removeListener("asset-changed", assetChangedHandler);
          eventEmitter.removeListener("boot-done", bootDoneHandler);
        });
        return;
      }

      // ── In-memory page lookup ────────────────────────────────────────────
      const reqUrl = `${origin}${req.path}`;
      // Try the literal path first, then the trailing-slash toggle so that
      // `/blog` and `/blog/` both resolve a page stored as `pages/blog/index.html`.
      const page =
        mem.getPageExact(pathname) ??
        mem.getPageExact(pathname.endsWith("/") ? pathname.slice(0, -1) : `${pathname}/`) ??
        mem.getPage(pathname);

      if (!page) {
        // During the initial transpile, serve a boot page instead of 404.
        // The boot page connects to the SSE endpoint and reloads automatically
        // when its specific page is transpiled or when boot finishes entirely.
        if (mem.isBooting && !BascikConfig.isProdServer) {
          responseStatus = 200;
          res.respond(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...SECURITY_HEADERS });
          return res.end(isHead ? undefined : BOOT_PAGE_HTML);
        }
        responseStatus = 404;
        res.respond(404, { ...SECURITY_HEADERS });
        return res.end("Not Found");
      }

      // A page is the 404 page only when its resolved HTTP path is exactly
      // /404 — `pages/blog/404.html` (a page *about* 404s) must not match.
      const is404Page = getHttpPath(page.relativePagePath) === "/404";

      responseStatus = is404Page ? 404 : 200;

      const responseHeaders: Record<string, string | number> = {
        "content-type": "text/html; charset=utf-8",
        "vary": "Accept-Encoding",
        ...SECURITY_HEADERS,
      };

      if (BascikConfig.cacheHttp === false) {
        responseHeaders["cache-control"] =
          "no-store, no-cache, must-revalidate, proxy-revalidate";
        responseHeaders["pragma"] = "no-cache";
        responseHeaders["expires"] = "0";
      }

      // ── Pages with server scripts: generated fresh each request ──────────
      // Server-script output is personalized per-request; always prevent caching.
      if (page.hasServerScripts) {
        const searchParams = Object.fromEntries(
          new URLSearchParams(qIdx === -1 ? "" : req.path.slice(qIdx + 1)),
        );
        const requestHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (k.startsWith(":")) continue; // skip HTTP/2 pseudo-headers
          requestHeaders[k] = Array.isArray(v) ? v.join(", ") : (v ?? "");
        }
        const html = await executeServerScripts(page.content.toString(), {
          path: pathname,
          method: req.method ?? "GET",
          headers: requestHeaders,
          searchParams,
        }, BascikConfig.serve?.scriptTimeout ?? DEFAULT_SCRIPT_TIMEOUT_MS);
        const htmlBuf = Buffer.from(html);
        responseHeaders["cache-control"] = "private, no-store";
        responseHeaders["content-length"] = htmlBuf.byteLength;
        res.respond(responseStatus, responseHeaders);
        return res.end(isHead ? undefined : htmlBuf);
      }

      // ── ETag + conditional GET (skip for no-store pages) ─────────────────
      const etag = makeEtag(page.content);
      if (BascikConfig.cacheHttp !== false && req.headers["if-none-match"] === etag) {
        responseStatus = 304;
        res.respond(304, { etag, ...SECURITY_HEADERS });
        return res.end();
      }
      responseHeaders["etag"] = etag;

      // ── Brotli or uncompressed ────────────────────────────────────────────
      const rawAcceptEncoding = req.headers["accept-encoding"] ?? "";
      const acceptEncoding = Array.isArray(rawAcceptEncoding)
        ? rawAcceptEncoding.join(", ")
        : rawAcceptEncoding;

      if (/\bbr\b/.test(acceptEncoding) && page.compressedContent) {
        responseHeaders["content-encoding"] = "br";
        responseHeaders["content-length"] = page.compressedContent.byteLength;
        res.respond(responseStatus, responseHeaders);
        return res.end(isHead ? undefined : page.compressedContent);
      }

      responseHeaders["content-length"] = page.content.byteLength;
      res.respond(responseStatus, responseHeaders);
      return res.end(isHead ? undefined : page.content);
    } catch (error) {
      onError(error, res);
    } finally {
      logAccess();
    }
  };

  if (disableTls) {
    server.on("request", async (reqMsg, resMsg) => {
      const { req, res } = adaptHttp1(reqMsg, resMsg);
      await handleRequest(req, res);
    });
  } else {
    (server as http2.Http2SecureServer).on(
      "stream",
      async (stream, headers) => {
        const { req, res } = adaptHttp2(stream, headers);
        await handleRequest(req, res);
      }
    );
  }

  // Find the first available port, incrementing if the preferred one is in use.
  await new Promise<void>((resolve, reject) => {
    const tryPort = (p: number) => {
      const errorHandler = (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          console.warn(`Port ${p} is in use, trying ${p + 1}…`);
          tryPort(p + 1);
        } else {
          reject(err);
        }
      };
      server.once("error", errorHandler);
      server.listen(p, hostname, () => {
        server.removeListener("error", errorHandler);
        origin = `${disableTls ? "http" : "https"}://${hostname}:${p}`;
        resolve();
      });
    };
    tryPort(startPort);
  });

  // General runtime error handler (registered after bind so it doesn't
  // intercept EADDRINUSE events during the port-finding loop above).
  server.on("error", (error) => console.error(error));

  // ── Graceful shutdown on SIGTERM / SIGINT ────────────────────────────────
  let shuttingDown = false;
  const gracefulShutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\nReceived ${signal}, shutting down gracefully…`);
    // Destroy open sessions and underlying sockets so streams close immediately.
    for (const session of openSessions) {
      try {
        session.destroy();
      } catch { }
    }
    openSessions.clear();
    // Close all registered handles (chokidar watchers, exec watchers).
    runShutdownHandlers().catch(() => { });

    server.close((err) => {
      if (err) console.error("Error closing server:", err);
      process.exit(0);
    });

    // Force exit if sessions or connections haven't drained within 10 s.
    setTimeout(() => {
      console.error("Graceful shutdown timeout — forcing exit");
      process.exit(1);
    }, 10_000).unref();
  };
  process.setMaxListeners(process.getMaxListeners() + 2);
  process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.once("SIGINT", () => gracefulShutdown("SIGINT"));

  return origin;
};
