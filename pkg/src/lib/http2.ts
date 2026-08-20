import { readFile } from "node:fs/promises";
import http2 from "node:http2";
import type { ServerHttp2Stream, IncomingHttpHeaders } from "node:http2";
import { BascikConfig } from "./config.js";
import { ensureCertificates } from "./pki.js";
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
  const { keyPath, certPath } = await ensureCertificates({
    keyFile: BascikConfig.serve?.keyFile,
    certFile: BascikConfig.serve?.certFile,
  });

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
