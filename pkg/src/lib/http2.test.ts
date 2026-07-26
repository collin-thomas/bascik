import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Hoisted mock factories ───────────────────────────────────────────────────

const { mockServer, mockCreateSecureServer } = vi.hoisted(() => {
  const mockServer = {
    on: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    removeListener: vi.fn().mockReturnThis(),
    listen: vi.fn().mockImplementation(
      (_port: number, _hostname: string, cb?: () => void) => { cb?.(); },
    ),
  };
  const mockCreateSecureServer = vi.fn(() => mockServer);
  return { mockServer, mockCreateSecureServer };
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("node:http2", () => ({
  default: { createSecureServer: mockCreateSecureServer },
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("mock-cert")),
  access: vi.fn().mockResolvedValue(undefined), // certs exist by default
}));

vi.mock("node:child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => cb(null, { stdout: "", stderr: "" })),
}));

vi.mock("node:fs", () => ({
  createReadStream: vi.fn(),
}));

vi.mock("./mem.js", () => ({
  mem: { getPage: vi.fn() },
}));

vi.mock("./config.js", () => ({
  BascikConfig: {
    cacheHttp: false,
    directory: { pages: "src/pages", components: "src/components" },
  },
}));

vi.mock("./events.js", () => ({
  eventEmitter: {
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

vi.mock("./paths.js", () => ({
  getHttpPath: vi.fn((p: string) => p),
}));

vi.mock("./mime.js", () => ({
  MIME_MAP: new Map([
    [".css", "text/css; charset=utf-8"],
    [".js", "application/javascript; charset=utf-8"],
    [".png", "image/png"],
  ]),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { serveHttp2 } from "./http2.js";
import { mem } from "./mem.js";
import { createReadStream } from "node:fs";

const mockMem = mem as unknown as { getPage: ReturnType<typeof vi.fn> };
const mockCreateReadStream = createReadStream as unknown as ReturnType<
  typeof vi.fn
>;

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeStream = () => ({
  respond: vi.fn(),
  end: vi.fn(),
  write: vi.fn(),
  on: vi.fn(),
  destroyed: false,
  pipe: vi.fn(),
});

const makeHeaders = (
  path?: string,
  method = "GET",
  acceptEncoding = "",
  referer?: string,
) => ({
  ":path": path,
  ":method": method,
  "accept-encoding": acceptEncoding,
  referer,
});

const getStreamHandler = () => {
  const call = mockServer.on.mock.calls.find((c: any[]) => c[0] === "stream");
  return call?.[1] as
    | ((stream: any, headers: any) => Promise<void>)
    | undefined;
};

// ─────────────────────────────────────────────────────────────────────────────
// Server setup
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – server setup", () => {
  it("creates a secure server", async () => {
    await serveHttp2();
    expect(mockCreateSecureServer).toHaveBeenCalledWith({
      key: expect.any(Buffer),
      cert: expect.any(Buffer),
    });
  });

  it("registers a stream event handler", async () => {
    await serveHttp2();
    const registered = mockServer.on.mock.calls.map((c: any[]) => c[0]);
    expect(registered).toContain("stream");
  });

  it("calls server.listen", async () => {
    await serveHttp2();
    expect(mockServer.listen).toHaveBeenCalledWith(
      8443,
      "localhost",
      expect.any(Function),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stream handler – method/path validation
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – stream handler", () => {
  beforeEach(async () => {
    await serveHttp2();
  });

  it("responds 405 for non-GET methods", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about", "POST"));
    expect(stream.respond).toHaveBeenCalledWith({ ":status": 405 });
    expect(stream.end).toHaveBeenCalledWith("Method Not Allowed");
  });

  it("responds 400 when path is missing", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders(undefined, "GET"));
    expect(stream.respond).toHaveBeenCalledWith({ ":status": 400 });
  });

  it("responds 404 for paths with dots in directory names but no file extension", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    // extname("/img.dir/dog") === "" (no ext on last segment) but split(".").length > 1
    await handler(stream, makeHeaders("/img.dir/dog", "GET"));
    expect(stream.respond).toHaveBeenCalledWith({ ":status": 404 });
  });

  it("responds 404 when mem.getPage returns undefined", async () => {
    mockMem.getPage.mockReturnValue(undefined);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/missing-page", "GET"));
    expect(stream.respond).toHaveBeenCalledWith({ ":status": 404 });
  });

  it("responds 200 with page content when mem.getPage returns a page", async () => {
    const mockPage = {
      relativePagePath: "pages/about.html",
      absolutePagePath: "/abs/pages/about.html",
      content: Buffer.from("<html>About</html>"),
      compressedContent: Buffer.from("compressed"),
      usedComponentsSet: new Set<string>(),
    };
    mockMem.getPage.mockReturnValue(mockPage);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 200 }),
    );
    expect(stream.end).toHaveBeenCalledWith(mockPage.content);
  });

  it("responds 404 with 404 page content when mem.getPage returns a 404 page", async () => {
    const mockPage = {
      relativePagePath: "pages/404.html",
      absolutePagePath: "/abs/pages/404.html",
      content: Buffer.from("<html>404 Not Found</html>"),
      compressedContent: Buffer.from("compressed"),
      usedComponentsSet: new Set<string>(),
    };
    mockMem.getPage.mockReturnValue(mockPage);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/some-missing-page", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 404 }),
    );
    expect(stream.end).toHaveBeenCalledWith(mockPage.content);
  });

  it("sends brotli-compressed content when client accepts br encoding", async () => {
    const mockPage = {
      relativePagePath: "pages/index.html",
      absolutePagePath: "/abs/pages/index.html",
      content: Buffer.from("<html>Home</html>"),
      compressedContent: Buffer.from("br-compressed"),
      usedComponentsSet: new Set<string>(),
    };
    mockMem.getPage.mockReturnValue(mockPage);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/", "GET", "br, gzip"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ "content-encoding": "br" }),
    );
    expect(stream.end).toHaveBeenCalledWith(mockPage.compressedContent);
  });

  it("sets no-cache headers when BascikConfig.cacheHttp is false", async () => {
    const mockPage = {
      relativePagePath: "pages/index.html",
      absolutePagePath: "/abs/pages/index.html",
      content: Buffer.from("<html></html>"),
      compressedContent: Buffer.from("br"),
      usedComponentsSet: new Set<string>(),
    };
    mockMem.getPage.mockReturnValue(mockPage);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        "Cache-Control": expect.stringContaining("no-store"),
      }),
    );
  });

  it("pipes a file stream for static asset requests", async () => {
    const fakeFileStream = {
      on: vi.fn().mockReturnThis(),
      pipe: vi.fn(),
    };
    mockCreateReadStream.mockReturnValue(fakeFileStream);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/style.css", "GET"));
    expect(mockCreateReadStream).toHaveBeenCalled();
    // Trigger the open event to verify pipe is called
    const openCall = fakeFileStream.on.mock.calls.find(
      (c: any[]) => c[0] === "open",
    );
    openCall?.[1]?.();
    expect(fakeFileStream.pipe).toHaveBeenCalledWith(stream);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Port auto-increment
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – port auto-increment", () => {
  afterEach(() => {
    // Restore default listen behaviour so subsequent tests are unaffected.
    mockServer.listen.mockImplementation(
      (_port: number, _hostname: string, cb?: () => void) => { cb?.(); },
    );
  });

  it("retries the next port when the preferred port is in use", async () => {
    let callCount = 0;
    mockServer.listen.mockImplementation(
      (_port: number, _hostname: string, cb?: () => void) => {
        callCount++;
        if (callCount === 1) {
          // Fire the EADDRINUSE error through the once-registered handler.
          const [, errorHandler] = mockServer.once.mock.calls.at(-1) as [
            string,
            (err: NodeJS.ErrnoException) => void,
          ];
          const err = Object.assign(new Error("EADDRINUSE"), { code: "EADDRINUSE" });
          errorHandler(err);
        } else {
          cb?.();
        }
      },
    );

    await serveHttp2();

    expect(mockServer.listen).toHaveBeenCalledTimes(2);
    expect(mockServer.listen).toHaveBeenNthCalledWith(1, 8443, "localhost", expect.any(Function));
    expect(mockServer.listen).toHaveBeenNthCalledWith(2, 8444, "localhost", expect.any(Function));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cert auto-generation
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – cert generation", () => {
  let mockAccess: ReturnType<typeof vi.fn>;
  let mockExecFile: ReturnType<typeof vi.fn>;

  // execFile is promisified; the callback is always the last argument.
  // mkcert gets an options object: execFile(cmd, args, opts, cb) → cb at index 3.
  // openssl has no options:        execFile(cmd, args, cb)       → cb at index 2.
  type ExecFileCb = (err: Error | null) => void;
  const lastArg = (args: unknown[]) => args[args.length - 1] as ExecFileCb;
  const succeed = (...args: unknown[]) => lastArg(args)(null);
  const fail = (msg: string) => (...args: unknown[]) => lastArg(args)(new Error(msg));

  beforeEach(async () => {
    const { access } = await import("node:fs/promises");
    const { execFile } = await import("node:child_process");
    mockAccess = access as ReturnType<typeof vi.fn>;
    mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;
    // Default for each cert test: certs already exist, execFile succeeds.
    mockAccess.mockResolvedValue(undefined);
    mockExecFile.mockImplementation(succeed);
  });

  it("skips cert generation when cert files already exist", async () => {
    await serveHttp2();
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("runs mkcert when cert files are missing", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    await serveHttp2();

    expect(mockExecFile).toHaveBeenCalledWith(
      "mkcert",
      expect.arrayContaining(["-key-file", "-cert-file", "localhost"]),
      expect.objectContaining({ env: expect.any(Object) }),
      expect.any(Function),
    );
  });

  it("passes augmented PATH to mkcert so Homebrew bin dirs are included", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));

    await serveHttp2();

    const [, , opts] = mockExecFile.mock.calls[0] as [string, string[], { env: { PATH: string } }, ExecFileCb];
    expect(opts.env.PATH).toContain("/opt/homebrew/bin");
    expect(opts.env.PATH).toContain("/usr/local/bin");
  });

  it("falls back to openssl when mkcert is not available", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockExecFile
      .mockImplementationOnce(fail("mkcert not found"))
      .mockImplementationOnce(succeed);

    await serveHttp2();

    expect(mockExecFile).toHaveBeenCalledTimes(2);
    expect(mockExecFile).toHaveBeenNthCalledWith(
      2,
      "openssl",
      expect.arrayContaining(["req", "-x509"]),
      expect.any(Function),
    );
  });

  it("logs a message when mkcert fails and openssl is used instead", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    mockExecFile
      .mockImplementationOnce(fail("spawn mkcert ENOENT"))
      .mockImplementationOnce(succeed);
    const consoleSpy = vi.spyOn(console, "log");

    await serveHttp2();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("mkcert not found or failed"),
    );
  });
});
