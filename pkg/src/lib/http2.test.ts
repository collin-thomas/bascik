import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockServer, mockCreateSecureServer, mockStartHttpServer } = vi.hoisted(() => {
  const mockServer = {
    on: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    removeListener: vi.fn().mockReturnThis(),
    listen: vi.fn().mockImplementation(
      (_port: number, _hostname: string, cb?: () => void) => { cb?.(); },
    ),
    close: vi.fn().mockImplementation((cb?: (err?: Error) => void) => { cb?.(); }),
  };
  const mockCreateSecureServer = vi.fn(() => mockServer);
  const mockStartHttpServer = vi.fn().mockResolvedValue("http://localhost:8443");
  return { mockServer, mockCreateSecureServer, mockStartHttpServer };
});

vi.mock("node:http2", () => ({
  default: {
    createSecureServer: mockCreateSecureServer,
    constants: { NGHTTP2_INTERNAL_ERROR: 2 },
  },
}));

vi.mock("./http.js", () => ({
  startHttpServer: mockStartHttpServer,
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("mock-cert")),
  access: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => cb(null, { stdout: "", stderr: "" })),
}));

vi.mock("./config.js", () => ({
  BascikConfig: {
    serve: {
      enableTls: true,
    },
  },
}));

import { startHttp2Server, adaptHttp2 } from "./http2.js";

describe("startHttp2Server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a secure HTTP/2 server", async () => {
    await startHttp2Server();
    expect(mockCreateSecureServer).toHaveBeenCalled();
  });
});

describe("adaptHttp2", () => {
  it("adapts stream and headers and calls stream.end with no arguments when chunk is undefined", () => {
    const mockStream: any = {
      headersSent: false,
      destroyed: false,
      session: { socket: { remoteAddress: "127.0.0.1" } },
      respond: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    };

    const { req, res } = adaptHttp2(mockStream, { ":method": "GET", ":path": "/api" });
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/api");
    expect(req.remoteIp).toBe("127.0.0.1");

    res.respond(200, { "content-type": "application/json" });
    expect(mockStream.respond).toHaveBeenCalledWith({ ":status": 200, "content-type": "application/json" });

    res.end(undefined);
    expect(mockStream.end).toHaveBeenCalledWith();
  });

  it("attaches error event listener to the stream to prevent unhandled error crashes", () => {
    const mockStream: any = {
      headersSent: false,
      destroyed: false,
      session: { socket: { remoteAddress: "127.0.0.1" } },
      respond: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    };

    adaptHttp2(mockStream, { ":method": "GET", ":path": "/" });
    expect(mockStream.on).toHaveBeenCalledWith("error", expect.any(Function));
  });
});
