import { readFile, access } from "node:fs/promises";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);
import { resolve } from "node:path";
import http2 from "node:http2";
import type { ServerHttp2Stream, IncomingHttpHeaders } from "node:http2";
import { BascikConfig } from "./config.js";
import {
  createRequestHandler,
  isNetworkResetError,
  startServerInstance,
  type BascikRequest,
  type BascikResponse
} from "./server.js";

export { _rateLimiter } from "./server.js";

export const adaptHttp2 = (stream: ServerHttp2Stream, headers: IncomingHttpHeaders): { req: BascikRequest; res: BascikResponse } => {
  let remoteIp = "unknown";
  try {
    remoteIp = (stream as any).session?.socket?.remoteAddress ?? "unknown";
  } catch { }

  stream.on("error", (err) => {
    if (isNetworkResetError(err)) return;
    console.error("[bascik] HTTP/2 stream error:", err);
  });

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
      if (arguments.length === 0 || chunk === undefined) {
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

export const startHttp2Server = async (): Promise<string> => {
  const usingCustomCerts = !!(BascikConfig.serve?.keyFile || BascikConfig.serve?.certFile);
  const keyPath = resolve(process.cwd(), BascikConfig.serve?.keyFile ?? "bascik-privkey.pem");
  const certPath = resolve(process.cwd(), BascikConfig.serve?.certFile ?? "bascik-cert.pem");

  // Auto-generate certs if they don't exist yet.
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
    const env = {
      ...process.env,
      PATH: [
        process.env.PATH,
        "/opt/homebrew/bin",
        "/usr/local/bin",
      ].filter(Boolean).join(":"),
    };

    try {
      const { stdout, stderr } = await execFile("mkcert", [
        "-key-file", keyPath,
        "-cert-file", certPath,
        "localhost", "127.0.0.1", "::1",
      ], { env });
      if (stdout && stdout.trim()) {
        console.log(stdout.trim());
      }
      if (stderr && stderr.trim()) {
        console.log(stderr.trim());
      }
      console.log("SSL: generated trusted certs via mkcert");
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
          "Could not generate SSL certificates. Please install mkcert (recommended) or openssl, or set serve.enableTls to false in bascik.config.ts to serve over plaintext HTTP instead."
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

  const openSessions = new Set<http2.ServerHttp2Session>();
  server.on("session", (session: http2.ServerHttp2Session) => {
    openSessions.add(session);
    session.once("close", () => openSessions.delete(session));
    session.on("error", (err) => {
      if (isNetworkResetError(err)) return;
      console.error("[bascik] HTTP/2 session error:", err);
    });
  });

  const handleRequest = createRequestHandler();

  server.on(
    "stream",
    async (stream: ServerHttp2Stream, headers: IncomingHttpHeaders) => {
      const { req, res } = adaptHttp2(stream, headers);
      await handleRequest(req, res);
    },
  );

  return startServerInstance(
    server,
    "https",
    () => {
      for (const session of openSessions) {
        try {
          session.destroy();
        } catch { }
      }
      openSessions.clear();
    }
  );
};
