import { readFile, access } from "node:fs/promises";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);
import { extname, resolve } from "node:path";
import http2 from "node:http2";
import type { ServerHttp2Stream, IncomingHttpHeaders } from "node:http2";
import { mem } from "./mem.js";
import { BascikConfig } from "./config.js";
import { eventEmitter } from "./events.js";
import { getHttpPath } from "./paths.js";
import { MIME_MAP } from "./mime.js";
import { createReadStream } from "node:fs";

export const serveHttp2 = async () => {
  const hostname = "localhost";
  const startPort = 8443;
  let origin = "";

  const keyPath = resolve(process.cwd(), "bascik-privkey.pem");
  const certPath = resolve(process.cwd(), "bascik-cert.pem");

  // Auto-generate certs if they don't exist yet.
  // mkcert produces a CA-trusted cert (no browser warning).
  // openssl is the self-signed fallback (browser will warn).
  const certsPresent = await Promise.all([access(keyPath), access(certPath)])
    .then(() => true)
    .catch(() => false);

  if (!certsPresent) {
    try {
      await execFile("mkcert", [
        "-key-file", keyPath,
        "-cert-file", certPath,
        "localhost", "127.0.0.1", "::1",
      ]);
      console.log("SSL: generated trusted certs via mkcert (run `mkcert -install` once if you haven't)");
    } catch {
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

  const server = http2.createSecureServer({ key, cert });

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
      try {
        const req = {
          path: headers[":path"] as string | undefined,
          method: headers[":method"] as string | undefined,
        };

        // Only allow GET method to this server
        if (req.method !== "GET") {
          stream.respond({ ":status": 405 });
          stream.end("Method Not Allowed");
          return;
        }

        if (!req.path) {
          stream.respond({ ":status": 400 });
          return stream.end();
        }

        // Did they request a page with an ext? Try and serve it. Ignore html files.
        const ext = extname(req.path || "");
        if (ext && !ext.match(/^\.htm.*$/)) {
          const fullPath = resolve("dist" + req.path);
          const fileStream = createReadStream(fullPath);

          // Handle file not found or other read errors
          fileStream.on("error", (err) => {
            // Check if the stream is already destroyed to avoid sending multiple responses
            if (stream.destroyed) return;
            if ((err as NodeJS.ErrnoException).code === "ENOENT") {
              stream.respond({ ":status": 404 });
              stream.end("Not Found");
            } else {
              stream.respond({ ":status": 500 });
              stream.end("Internal Server Error");
            }
          });

          // Once the file is confirmed to be open, send success headers and pipe the data
          fileStream.on("open", () => {
            stream.respond({
              "content-type": MIME_MAP.get(ext) || MIME_MAP.get("octet-stream"),
              ":status": 200,
            });
            // Pipe file stream to network stream for optimal performance and low memory usage
            fileStream.pipe(stream);
          });

          return;
        }

        // Allow paths like /about or /article/how-to-program
        // But paths like /img/dog.png would 404
        if (req.path.split(".").length > 1) {
          stream.respond({ ":status": 404 });
          return stream.end();
        }

        const reqUrl = `${origin}${req.path}`;

        if (req.path === "/bascik-live-reload") {
          // Set SSE headers
          stream.respond({
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
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

          // Also reload when a static asset changes (CSS, images, etc.)
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

        const page = mem.getPage(req.path);

        if (!page) {
          // The developer did not configure a pages/404.html page.
          stream.respond({ ":status": 404 });
          return stream.end("Not Found");
        }

        console.log(`serving: ${reqUrl}`);

        const is404Page =
          page.relativePagePath === "/404" ||
          page.relativePagePath.endsWith("404.html") ||
          getHttpPath(page.relativePagePath) === "/404";

        const responseHeaders: Record<string, string | number> = {
          "Content-Type": "text/html; charset=utf-8",
          ":status": is404Page ? 404 : 200,
        };

        if (BascikConfig.cacheHttp === false) {
          responseHeaders["Cache-Control"] =
            "no-store, no-cache, must-revalidate, proxy-revalidate";
          responseHeaders["Pragma"] = "no-cache";
          responseHeaders["Expires"] = "0";
        }

        const acceptEncoding = headers["accept-encoding"] || "";

        // Send compressed
        if (/\bbr\b/.test(acceptEncoding)) {
          responseHeaders["content-encoding"] = "br";
          stream.respond(responseHeaders);
          return stream.end(page.compressedContent);
        }

        // Send uncompressed
        stream.respond(responseHeaders);
        return stream.end(page.content);
      } catch (error) {
        onError(error, stream);
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
};
