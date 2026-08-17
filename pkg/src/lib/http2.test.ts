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

import { startHttp2Server } from "./http2.js";

describe("startHttp2Server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a secure HTTP/2 server", async () => {
    await startHttp2Server();
    expect(mockCreateSecureServer).toHaveBeenCalled();
  });
});
