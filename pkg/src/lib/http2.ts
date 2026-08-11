import { readFile, access, stat } from "node:fs/promises";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);
import { extname, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import http2 from "node:http2";
import type { ServerHttp2Stream, IncomingHttpHeaders } from "node:http2";
import { mem } from "./mem.js";
import { BascikConfig } from "./config.js";
import { eventEmitter } from "./events.js";
import { getHttpPath } from "./paths.js";
import { MIME_MAP } from "./mime.js";
import { createReadStream } from "node:fs";
import { executeServerScripts } from "./server-scripts.js";

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

export const serveHttp2 = async () => {
  const hostname = BascikConfig.serve?.hostname ?? "localhost";
  const startPort = BascikConfig.serve?.port ?? 8443;
  const distDir = resolve(process.cwd(), "dist");
  let origin = "";

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

  const server = http2.createSecureServer({
    key,
    cert,
    settings: { maxConcurrentStreams: 250 },
  });

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
  const onError = (error: unknown, stream: ServerHttp2Stream): void => {
    try {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        stream.respond({ ":status": 404 });
      } else {
        stream.respond({ ":status": 500 });
      }
    } catch (respondErr) {
      console.error("Error responding to stream:", respondErr);
    }

    try {
      stream.end();
    } catch (endErr) {
      console.error("Error ending stream:", endErr);
    }

    console.error("Stream error:", error);
  };

  server.on(
    "stream",
    async (stream: ServerHttp2Stream, headers: IncomingHttpHeaders) => {
      const startMs = Date.now();
      let responseStatus = 0;

      const logAccess = () => {
        if (responseStatus === 0) return;
        const elapsed = Date.now() - startMs;
        const method = headers[":method"] ?? "-";
        const path = headers[":path"] ?? "-";
        // Skip noisy SSE keep-alive pings
        if (path === "/bascik-live-reload") return;
        console.log(`${method} ${path} ${responseStatus} ${elapsed}ms`);
      };

      try {
        const req = {
          path: headers[":path"] as string | undefined,
          method: headers[":method"] as string | undefined,
        };

        // ── Rate limiting ────────────────────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const remoteIp = (stream as any).session?.socket?.remoteAddress ?? "unknown";
        if (BascikConfig.isServe && isRateLimited(remoteIp)) {
          responseStatus = 429;
          stream.respond({ ":status": 429, "retry-after": String(RATE_WINDOW_MS / 1000), ...SECURITY_HEADERS });
          stream.end("Too Many Requests");
          return;
        }

        // ── Method guard: GET and HEAD only ──────────────────────────────────
        const isHead = req.method === "HEAD";
        if (req.method !== "GET" && !isHead) {
          responseStatus = 405;
          stream.respond({ ":status": 405, "allow": "GET, HEAD", ...SECURITY_HEADERS });
          stream.end("Method Not Allowed");
          return;
        }

        if (!req.path) {
          responseStatus = 400;
          stream.respond({ ":status": 400, ...SECURITY_HEADERS });
          return stream.end();
        }

        // Parse the request pathname once so routing decisions are never
        // confused by a query string (e.g. /style.css?v=1 or /search?email=a@b.com).
        const qIdx = req.path.indexOf("?");
        const pathname = qIdx === -1 ? req.path : req.path.slice(0, qIdx);

        // ── Static asset (has extension, not .html) ──────────────────────────
        const ext = extname(pathname);
        if (ext && !ext.match(/^\.htm.*$/)) {
          // Path traversal guard: resolved path must stay inside dist/
          const safePath = pathname.slice(1); // strip leading /
          const fullPath = resolve(distDir, safePath);
          if (!fullPath.startsWith(distDir + sep)) {
            responseStatus = 400;
            stream.respond({ ":status": 400, ...SECURITY_HEADERS });
            stream.end("Bad Request");
            return;
          }

          // Stat gives us size (for Content-Length) + mtime (for ETag) in one syscall.
          let fileStat: Awaited<ReturnType<typeof stat>>;
          try {
            fileStat = await stat(fullPath);
          } catch (err) {
            responseStatus = (err as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
            stream.respond({ ":status": responseStatus, ...SECURITY_HEADERS });
            stream.end(responseStatus === 404 ? "Not Found" : "Internal Server Error");
            return;
          }

          const etag = makeStatEtag(fileStat.mtimeMs, fileStat.size);
          if (BascikConfig.cacheHttp !== false && headers["if-none-match"] === etag) {
            responseStatus = 304;
            stream.respond({ ":status": 304, etag, ...SECURITY_HEADERS });
            stream.end();
            return;
          }

          const staticHeaders: Record<string, string | number> = {
            "content-type": MIME_MAP.get(ext) ?? (MIME_MAP.get("octet-stream") as string),
            "content-length": fileStat.size,
            ":status": 200,
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
            stream.respond(staticHeaders);
            stream.end();
            return;
          }

          const fileStream = createReadStream(fullPath);

          fileStream.on("error", (err) => {
            if (stream.destroyed) return;
            responseStatus = (err as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
            stream.respond({ ":status": responseStatus, ...SECURITY_HEADERS });
            stream.end(responseStatus === 404 ? "Not Found" : "Internal Server Error");
          });

          fileStream.on("open", () => {
            responseStatus = 200;
            stream.respond(staticHeaders);
            fileStream.pipe(stream);
          });

          return;
        }

        // ── Reject dot-paths that are not file extensions (e.g. /img.dir/dog) ─
        if (pathname.split(".").length > 1) {
          responseStatus = 404;
          stream.respond({ ":status": 404, ...SECURITY_HEADERS });
          return stream.end();
        }

        // ── Live-reload SSE ──────────────────────────────────────────────────
        if (pathname === "/bascik-live-reload") {
          // Disable in production serve mode.
          if (BascikConfig.isServe) {
            responseStatus = 404;
            stream.respond({ ":status": 404, ...SECURITY_HEADERS });
            return stream.end();
          }

          responseStatus = 200;
          stream.respond({
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            ...SECURITY_HEADERS,
          });

          stream.write(`data: connected\n\n`);

          const eventHandler = ({
            relativePagePath,
          }: {
            relativePagePath: string;
          }) => {
            const refererUrl = new URL(headers.referer as string);
            const httpPath = getHttpPath(relativePagePath);
            if (refererUrl.pathname !== httpPath) return;
            stream.write(`data: reload\n\n`);
          };

          const assetChangedHandler = () => {
            stream.write(`data: reload\n\n`);
          };

          eventEmitter.on("transpiled", eventHandler);
          eventEmitter.on("asset-changed", assetChangedHandler);

          stream.on("close", () => {
            eventEmitter.removeListener("transpiled", eventHandler);
            eventEmitter.removeListener("asset-changed", assetChangedHandler);
          });
          return;
        }

        // ── In-memory page lookup ────────────────────────────────────────────
        const reqUrl = `${origin}${req.path}`;
        const page = mem.getPage(pathname);

        if (!page) {
          responseStatus = 404;
          stream.respond({ ":status": 404, ...SECURITY_HEADERS });
          return stream.end("Not Found");
        }

        console.log(`serving: ${reqUrl}`);

        const is404Page =
          page.relativePagePath === "/404" ||
          page.relativePagePath.endsWith("404.html") ||
          getHttpPath(page.relativePagePath) === "/404";

        responseStatus = is404Page ? 404 : 200;

        const responseHeaders: Record<string, string | number> = {
          "content-type": "text/html; charset=utf-8",
          "vary": "Accept-Encoding",
          ":status": responseStatus,
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
          for (const [k, v] of Object.entries(headers)) {
            if (k.startsWith(":")) continue; // skip HTTP/2 pseudo-headers
            requestHeaders[k] = Array.isArray(v) ? v.join(", ") : (v ?? "");
          }
          const html = await executeServerScripts(page.content.toString(), {
            path: pathname,
            method: req.method ?? "GET",
            headers: requestHeaders,
            searchParams,
          });
          const htmlBuf = Buffer.from(html);
          responseHeaders["cache-control"] = "private, no-store";
          responseHeaders["content-length"] = htmlBuf.byteLength;
          stream.respond(responseHeaders);
          return stream.end(isHead ? undefined : htmlBuf);
        }

        // ── ETag + conditional GET (skip for no-store pages) ─────────────────
        const etag = makeEtag(page.content);
        if (BascikConfig.cacheHttp !== false && headers["if-none-match"] === etag) {
          responseStatus = 304;
          stream.respond({ ":status": 304, etag, ...SECURITY_HEADERS });
          return stream.end();
        }
        responseHeaders["etag"] = etag;

        // ── Brotli or uncompressed ────────────────────────────────────────────
        const acceptEncoding = headers["accept-encoding"] ?? "";

        if (/\bbr\b/.test(acceptEncoding) && page.compressedContent) {
          responseHeaders["content-encoding"] = "br";
          responseHeaders["content-length"] = page.compressedContent.byteLength;
          stream.respond(responseHeaders);
          return stream.end(isHead ? undefined : page.compressedContent);
        }

        responseHeaders["content-length"] = page.content.byteLength;
        stream.respond(responseHeaders);
        return stream.end(isHead ? undefined : page.content);
      } catch (error) {
        onError(error, stream);
      } finally {
        logAccess();
      }
    },
  );

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
        origin = `https://${hostname}:${p}`;
        console.log(`Server running at ${origin}`);
        resolve();
      });
    };
    tryPort(startPort);
  });

  // General runtime error handler (registered after bind so it doesn't
  // intercept EADDRINUSE events during the port-finding loop above).
  server.on("error", (error) => console.error(error));

  // ── Graceful shutdown on SIGTERM / SIGINT ────────────────────────────────
  const gracefulShutdown = (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully…`);
    server.close((err) => {
      if (err) console.error("Error closing server:", err);
      process.exit(0);
    });
    // Force exit if open sessions haven't drained within 10 s.
    setTimeout(() => {
      console.error("Graceful shutdown timeout — forcing exit");
      process.exit(1);
    }, 10_000).unref();
  };
  process.setMaxListeners(process.getMaxListeners() + 2);
  process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.once("SIGINT", () => gracefulShutdown("SIGINT"));
};
