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
    close: vi.fn().mockImplementation((cb?: (err?: Error) => void) => { cb?.(); }),
  };
  const mockCreateSecureServer = vi.fn(() => mockServer);
  return { mockServer, mockCreateSecureServer };
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("node:http2", () => ({
  default: {
    createSecureServer: mockCreateSecureServer,
    constants: { NGHTTP2_INTERNAL_ERROR: 2 },
  },
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("mock-cert")),
  access: vi.fn().mockResolvedValue(undefined), // certs exist by default
  stat: vi.fn().mockResolvedValue({ mtimeMs: 1_705_000_000_000, size: 1_024 }),
}));

vi.mock("node:child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => cb(null, { stdout: "", stderr: "" })),
}));

vi.mock("node:fs", () => ({
  createReadStream: vi.fn(),
}));

vi.mock("./mem.js", () => ({
  mem: { getPage: vi.fn(), getPageExact: vi.fn(), trackOpenPage: vi.fn(), untrackOpenPage: vi.fn() },
}));

vi.mock("./config.js", () => ({
  shouldLog: vi.fn(() => true),
  BascikConfig: {
    cacheHttp: false,
    isServe: false,
    directory: { pages: "src/pages", components: "src/components" },
  },
}));

vi.mock("./events.js", () => ({
  eventEmitter: {
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

vi.mock("./server-scripts.js", () => ({
  executeServerScripts: vi.fn(async (html: string) => html),
  DEFAULT_SCRIPT_TIMEOUT_MS: 5000,
}));

vi.mock("./paths.js", () => ({
  // Faithful port of the real getHttpPath so is404Page logic is genuinely
  // exercised: pages/404.html → /404, pages/blog/index.html → /blog/.
  getHttpPath: vi.fn((p: string) =>
    p.replace(/^pages/, "").replace(/\.html$/, "").replace(/\/index$/, "/")
  ),
}));

vi.mock("./mime.js", () => ({
  MIME_MAP: new Map([
    [".css", "text/css; charset=utf-8"],
    [".js", "application/javascript; charset=utf-8"],
    [".png", "image/png"],
  ]),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { serveHttp2, _rateLimiter } from "./http2.js";
import { mem } from "./mem.js";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { eventEmitter } from "./events.js";

const mockMem = mem as unknown as {
  getPage: ReturnType<typeof vi.fn>;
  getPageExact: ReturnType<typeof vi.fn>;
  trackOpenPage: ReturnType<typeof vi.fn>;
  untrackOpenPage: ReturnType<typeof vi.fn>;
};
const mockCreateReadStream = createReadStream as unknown as ReturnType<typeof vi.fn>;
const mockStat = stat as unknown as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  _rateLimiter.clear();
  // No exact-match pages by default — http2 falls back to mem.getPage (mocked per-test).
  mockMem.getPageExact.mockReturnValue(undefined);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeStream = () => ({
  respond: vi.fn(),
  end: vi.fn(),
  write: vi.fn(),
  on: vi.fn(),
  destroyed: false,
  pipe: vi.fn(),
  session: { socket: { remoteAddress: "127.0.0.1" } },
});

const makeHeaders = (
  path?: string,
  method = "GET",
  acceptEncoding = "",
  referer?: string,
  extra: Record<string, string> = {},
) => ({
  ":path": path,
  ":method": method,
  "accept-encoding": acceptEncoding,
  referer,
  ...extra,
});

const getStreamHandler = () => {
  const call = mockServer.on.mock.calls.find((c: any[]) => c[0] === "stream");
  return call?.[1] as
    | ((stream: any, headers: any) => Promise<void>)
    | undefined;
};

/** Returns a mock page suitable for most response tests. */
const makePage = (overrides: Record<string, unknown> = {}) => ({
  relativePagePath: "pages/about.html",
  absolutePagePath: "/abs/pages/about.html",
  content: Buffer.from("<html>About</html>"),
  compressedContent: undefined as Buffer | undefined,
  hasServerScripts: false,
  usedComponentsSet: new Set<string>(),
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// Server setup
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – server setup", () => {
  it("creates a secure server with key and cert", async () => {
    await serveHttp2();
    expect(mockCreateSecureServer).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.any(Buffer),
        cert: expect.any(Buffer),
      }),
    );
  });

  it("sets maxConcurrentStreams: 250 in HTTP/2 settings", async () => {
    await serveHttp2();
    expect(mockCreateSecureServer).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ maxConcurrentStreams: 250 }),
      }),
    );
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

  it("responds 405 for non-GET/HEAD methods", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about", "POST"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 405 }),
    );
    expect(stream.end).toHaveBeenCalledWith("Method Not Allowed");
  });

  it("responds 400 when path is missing", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders(undefined, "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 400 }),
    );
  });

  it("responds 404 for paths with dots in directory names but no file extension", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    // extname("/img.dir/dog") === "" (no ext on last segment) but split(".").length > 1
    await handler(stream, makeHeaders("/img.dir/dog", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 404 }),
    );
  });

  it("responds 404 when mem.getPage returns undefined", async () => {
    mockMem.getPage.mockReturnValue(undefined);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/missing-page", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 404 }),
    );
  });

  it("responds 200 with page content when mem.getPage returns a page", async () => {
    const page = makePage({ content: Buffer.from("<html>About</html>") });
    mockMem.getPage.mockReturnValue(page);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 200 }),
    );
    expect(stream.end).toHaveBeenCalledWith(page.content);
  });

  it("responds 404 with 404 page content when mem.getPage returns a 404 page", async () => {
    const page = makePage({
      relativePagePath: "pages/404.html",
      content: Buffer.from("<html>404 Not Found</html>"),
      compressedContent: Buffer.from("compressed"),
    });
    mockMem.getPage.mockReturnValue(page);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/some-missing-page", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 404 }),
    );
    expect(stream.end).toHaveBeenCalledWith(page.content);
  });

  it("sends brotli-compressed content when client accepts br encoding", async () => {
    const page = makePage({
      content: Buffer.from("<html>Home</html>"),
      compressedContent: Buffer.from("br-compressed"),
    });
    mockMem.getPage.mockReturnValue(page);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/", "GET", "br, gzip"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ "content-encoding": "br" }),
    );
    expect(stream.end).toHaveBeenCalledWith(page.compressedContent);
  });

  it("falls back to uncompressed content when background brotli compression hasn't finished yet", async () => {
    const page = makePage({
      content: Buffer.from("<html>Home</html>"),
      compressedContent: undefined,
    });
    mockMem.getPage.mockReturnValue(page);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/", "GET", "br, gzip"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.not.objectContaining({ "content-encoding": "br" }),
    );
    expect(stream.end).toHaveBeenCalledWith(page.content);
  });

  it("sets no-cache headers when BascikConfig.cacheHttp is false", async () => {
    const page = makePage({ content: Buffer.from("<html></html>") });
    mockMem.getPage.mockReturnValue(page);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        "cache-control": expect.stringContaining("no-store"),
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
    expect(mockStat).toHaveBeenCalled();
    expect(mockCreateReadStream).toHaveBeenCalled();
    // Trigger the open event to verify pipe is called
    const openCall = fakeFileStream.on.mock.calls.find((c: any[]) => c[0] === "open");
    openCall?.[1]?.();
    expect(fakeFileStream.pipe).toHaveBeenCalledWith(stream);
  });

  it("treats uppercase .HTML extensions like lowercase (no static-file lookup)", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/index.HTML", "GET"));
    // Must follow the same route as /index.html — rejected as a dot-path,
    // never stat()'d on disk as a static asset.
    expect(mockStat).not.toHaveBeenCalled();
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 404 }),
    );
  });

  it("resolves the MIME type for uppercase static asset extensions", async () => {
    const fakeFileStream = { on: vi.fn().mockReturnThis(), pipe: vi.fn() };
    mockCreateReadStream.mockReturnValue(fakeFileStream);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/STYLE.CSS", "HEAD"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        "content-type": expect.stringContaining("text/css"),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Security headers
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – security headers", () => {
  beforeEach(async () => {
    await serveHttp2();
  });

  const EXPECTED_SECURITY_HEADERS = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "SAMEORIGIN",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "interest-cohort=()",
  };

  it("includes security headers on page responses", async () => {
    mockMem.getPage.mockReturnValue(makePage());
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining(EXPECTED_SECURITY_HEADERS),
    );
  });

  it("includes security headers on 404 responses", async () => {
    mockMem.getPage.mockReturnValue(undefined);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/missing", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining(EXPECTED_SECURITY_HEADERS),
    );
  });

  it("includes security headers on 405 responses", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about", "DELETE"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining(EXPECTED_SECURITY_HEADERS),
    );
  });

  it("includes security headers on static asset responses", async () => {
    const fakeFileStream = { on: vi.fn().mockReturnThis(), pipe: vi.fn() };
    mockCreateReadStream.mockReturnValue(fakeFileStream);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/style.css", "GET"));
    const openCall = fakeFileStream.on.mock.calls.find((c: any[]) => c[0] === "open");
    openCall?.[1]?.();
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining(EXPECTED_SECURITY_HEADERS),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HEAD method
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – HEAD method", () => {
  beforeEach(async () => {
    await serveHttp2();
  });

  it("responds 200 for HEAD on a page without a body", async () => {
    mockMem.getPage.mockReturnValue(makePage({ content: Buffer.from("<html>Hi</html>") }));
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about", "HEAD"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 200 }),
    );
    // HEAD must not send a body
    expect(stream.end).toHaveBeenCalledWith(undefined);
  });

  it("includes Content-Length in HEAD response", async () => {
    const content = Buffer.from("<html>Hello</html>");
    mockMem.getPage.mockReturnValue(makePage({ content }));
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about", "HEAD"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ "content-length": content.byteLength }),
    );
  });

  it("responds 200 for HEAD on a static asset without creating a read stream body", async () => {
    const fakeFileStream = { on: vi.fn().mockReturnThis(), pipe: vi.fn(), destroy: vi.fn() };
    mockCreateReadStream.mockReturnValue(fakeFileStream);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/style.css", "HEAD"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 200 }),
    );
    expect(fakeFileStream.pipe).not.toHaveBeenCalled();
    expect(stream.end).toHaveBeenCalledWith();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Content-Length and Vary headers
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – Content-Length and Vary", () => {
  beforeEach(async () => {
    await serveHttp2();
  });

  it("sets content-length equal to buffer byte length for uncompressed pages", async () => {
    const content = Buffer.from("<html>Hello world</html>");
    mockMem.getPage.mockReturnValue(makePage({ content }));
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ "content-length": content.byteLength }),
    );
  });

  it("sets content-length to compressed size when sending brotli", async () => {
    const compressed = Buffer.from("br-data");
    mockMem.getPage.mockReturnValue(
      makePage({ content: Buffer.from("<html>Hi</html>"), compressedContent: compressed }),
    );
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/", "GET", "br"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ "content-length": compressed.byteLength }),
    );
  });

  it("sets Vary: Accept-Encoding on page responses", async () => {
    mockMem.getPage.mockReturnValue(makePage());
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ "vary": "Accept-Encoding" }),
    );
  });

  it("sets content-length on static asset responses", async () => {
    const fakeFileStream = { on: vi.fn().mockReturnThis(), pipe: vi.fn() };
    mockCreateReadStream.mockReturnValue(fakeFileStream);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/style.css", "GET"));
    const openCall = fakeFileStream.on.mock.calls.find((c: any[]) => c[0] === "open");
    openCall?.[1]?.();
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ "content-length": 1_024 }), // from mockStat default
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ETag and 304 Not Modified
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – ETag and conditional GET", () => {
  beforeEach(async () => {
    await serveHttp2();
  });

  it("sets an ETag header on page responses", async () => {
    mockMem.getPage.mockReturnValue(makePage());
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ etag: expect.stringMatching(/^"[A-Za-z0-9_-]+"$/) }),
    );
  });

  it("returns 304 when If-None-Match matches and cacheHttp is enabled", async () => {
    const { BascikConfig } = await import("./config.js");
    // Temporarily set cacheHttp to true for this test
    (BascikConfig as any).cacheHttp = true;

    const page = makePage({ content: Buffer.from("<html>Cached</html>") });
    mockMem.getPage.mockReturnValue(page);

    // First request: get the ETag
    const handler = getStreamHandler()!;
    const stream1 = makeStream();
    await handler(stream1, makeHeaders("/about", "GET"));
    const respondCall = stream1.respond.mock.calls[0][0] as Record<string, unknown>;
    const etag = respondCall["etag"] as string;

    // Second request: conditional GET with matching ETag
    const stream2 = makeStream();
    await handler(stream2, makeHeaders("/about", "GET", "", undefined, { "if-none-match": etag }));
    expect(stream2.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 304 }),
    );
    expect(stream2.end).toHaveBeenCalledWith();

    (BascikConfig as any).cacheHttp = false;
  });

  it("does not return 304 when cacheHttp is false (no-store mode)", async () => {
    const page = makePage({ content: Buffer.from("<html>Cached</html>") });
    mockMem.getPage.mockReturnValue(page);

    const handler = getStreamHandler()!;
    // First request to capture ETag
    const stream1 = makeStream();
    await handler(stream1, makeHeaders("/about", "GET"));
    const respondCall = stream1.respond.mock.calls[0][0] as Record<string, unknown>;
    const etag = respondCall["etag"] as string;

    // Second request with matching ETag — should still return 200 because cacheHttp is false
    mockMem.getPage.mockReturnValue(page);
    const stream2 = makeStream();
    await handler(stream2, makeHeaders("/about", "GET", "", undefined, { "if-none-match": etag }));
    expect(stream2.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 200 }),
    );
  });

  it("sets an ETag header on static asset responses", async () => {
    const { BascikConfig } = await import("./config.js");
    (BascikConfig as any).cacheHttp = true;
    const fakeFileStream = { on: vi.fn().mockReturnThis(), pipe: vi.fn() };
    mockCreateReadStream.mockReturnValue(fakeFileStream);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/style.css", "GET"));
    const openCall = fakeFileStream.on.mock.calls.find((c: any[]) => c[0] === "open");
    openCall?.[1]?.();
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ etag: expect.stringMatching(/^W\/"[0-9a-z]+-[0-9a-z]+"$/) }),
    );
    (BascikConfig as any).cacheHttp = false;
  });

  it("returns 304 for a static asset when If-None-Match matches", async () => {
    const { BascikConfig } = await import("./config.js");
    (BascikConfig as any).cacheHttp = true;
    // Stat returns deterministic values so the ETag is predictable
    const mtimeMs = 1_705_000_000_000;
    const size = 1_024;
    mockStat.mockResolvedValue({ mtimeMs, size });

    const handler = getStreamHandler()!;
    // First GET to read the ETag
    const fakeFileStream = { on: vi.fn().mockReturnThis(), pipe: vi.fn() };
    mockCreateReadStream.mockReturnValue(fakeFileStream);
    const stream1 = makeStream();
    await handler(stream1, makeHeaders("/style.css", "GET"));
    const openCall = fakeFileStream.on.mock.calls.find((c: any[]) => c[0] === "open");
    openCall?.[1]?.();
    const etag = (stream1.respond.mock.calls[0][0] as Record<string, unknown>)["etag"] as string;

    // Second GET with matching ETag → 304
    const stream2 = makeStream();
    await handler(stream2, makeHeaders("/style.css", "GET", "", undefined, { "if-none-match": etag }));
    expect(stream2.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 304 }),
    );
    expect(stream2.end).toHaveBeenCalledWith();
    (BascikConfig as any).cacheHttp = false;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Path traversal protection
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – path traversal protection", () => {
  beforeEach(async () => {
    await serveHttp2();
  });

  it("returns 400 for a path traversal attempt in a static asset URL", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    // Extension present → goes through static asset branch; /../../../ escapes dist/
    await handler(stream, makeHeaders("/../../../etc/shadow.cfg", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 400 }),
    );
    expect(stream.end).toHaveBeenCalledWith("Bad Request");
  });

  it("serves a file whose name contains literal %2F without escaping (not a traversal)", async () => {
    // path.resolve treats %2F as a literal character, not a /; the guard passes
    // and stat is called. Mock stat succeeds, then createReadStream is set up.
    const fakeFileStream = { on: vi.fn().mockReturnThis(), pipe: vi.fn() };
    mockCreateReadStream.mockReturnValue(fakeFileStream);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/safe%2Ffile.txt", "GET"));
    // Guard passes (stays inside dist/). stat succeeds. Response is set up.
    expect(mockStat).toHaveBeenCalled();
    // Trigger open to send headers
    const openCall = fakeFileStream.on.mock.calls.find((c: any[]) => c[0] === "open");
    openCall?.[1]?.();
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 200 }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – rate limiting", () => {
  beforeEach(async () => {
    // Rate limiting is isServe-only; enable it for this suite.
    const { BascikConfig } = await import("./config.js");
    (BascikConfig as any).isServe = true;
    await serveHttp2();
  });

  afterEach(async () => {
    const { BascikConfig } = await import("./config.js");
    (BascikConfig as any).isServe = false;
  });

  it("allows requests below the rate limit", async () => {
    mockMem.getPage.mockReturnValue(makePage());
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 200 }),
    );
  });

  it("returns 429 when the per-IP request limit is exceeded", async () => {
    mockMem.getPage.mockReturnValue(makePage());
    const handler = getStreamHandler()!;

    // Flood with 501 requests from the same IP; the 501st must be throttled.
    const ip = "10.0.0.99";
    for (let i = 0; i < 501; i++) {
      const s = { ...makeStream(), session: { socket: { remoteAddress: ip } } };
      await handler(s, makeHeaders("/about", "GET"));
    }

    const throttledStream = { ...makeStream(), session: { socket: { remoteAddress: ip } } };
    await handler(throttledStream, makeHeaders("/about", "GET"));
    expect(throttledStream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 429 }),
    );
  });

  it("allows requests from different IPs independently", async () => {
    mockMem.getPage.mockReturnValue(makePage());
    const handler = getStreamHandler()!;

    // Exhaust quota for one IP
    for (let i = 0; i < 502; i++) {
      const s = { ...makeStream(), session: { socket: { remoteAddress: "1.2.3.4" } } };
      await handler(s, makeHeaders("/about", "GET"));
    }

    // A different IP should still be allowed
    const otherStream = { ...makeStream(), session: { socket: { remoteAddress: "9.9.9.9" } } };
    await handler(otherStream, makeHeaders("/about", "GET"));
    expect(otherStream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 200 }),
    );
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
// Graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – graceful shutdown", () => {
  const registeredHandlers: Map<string, (() => void)[]> = new Map();

  beforeEach(() => {
    vi.spyOn(process, "once").mockImplementation((event: string | symbol, listener: (...args: any[]) => void) => {
      const key = String(event);
      if (!registeredHandlers.has(key)) registeredHandlers.set(key, []);
      registeredHandlers.get(key)!.push(listener as () => void);
      return process;
    });
  });

  afterEach(() => {
    registeredHandlers.clear();
    vi.restoreAllMocks();
  });

  it("registers SIGTERM and SIGINT handlers after the server starts", async () => {
    await serveHttp2();
    const events = (process.once as ReturnType<typeof vi.spyOn>).mock.calls.map((c: any[]) => c[0]);
    expect(events).toContain("SIGTERM");
    expect(events).toContain("SIGINT");
  });

  it("calls server.close() on SIGTERM", async () => {
    await serveHttp2();
    const [, sigTermHandler] = (process.once as ReturnType<typeof vi.spyOn>).mock.calls.find(
      (c: any[]) => c[0] === "SIGTERM",
    ) as [string, () => void];

    const mockExit = vi.spyOn(process, "exit").mockImplementation((_code?: string | number | null) => undefined as never);
    sigTermHandler();
    expect(mockServer.close).toHaveBeenCalled();
    mockExit.mockRestore();
  });

  it("calls server.close() on SIGINT", async () => {
    await serveHttp2();
    const [, sigIntHandler] = (process.once as ReturnType<typeof vi.spyOn>).mock.calls.find(
      (c: any[]) => c[0] === "SIGINT",
    ) as [string, () => void];

    const mockExit = vi.spyOn(process, "exit").mockImplementation((_code?: string | number | null) => undefined as never);
    sigIntHandler();
    expect(mockServer.close).toHaveBeenCalled();
    mockExit.mockRestore();
  });

  it("destroys open sessions on SIGINT so long-lived SSE streams do not block shutdown", async () => {
    await serveHttp2();

    const [, sessionHandler] = mockServer.on.mock.calls.find(
      (c: any[]) => c[0] === "session",
    ) as [string, (session: { destroy: ReturnType<typeof vi.fn>; once: ReturnType<typeof vi.fn> }) => void];

    const mockSession = { destroy: vi.fn(), once: vi.fn() };
    sessionHandler(mockSession);

    const [, sigIntHandler] = (process.once as ReturnType<typeof vi.spyOn>).mock.calls.find(
      (c: any[]) => c[0] === "SIGINT",
    ) as [string, () => void];

    const mockExit = vi.spyOn(process, "exit").mockImplementation((_code?: string | number | null) => undefined as never);
    sigIntHandler();
    expect(mockSession.destroy).toHaveBeenCalled();
    mockExit.mockRestore();
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

// ─────────────────────────────────────────────────────────────────────────────
// SSE live-reload
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – SSE live-reload (/bascik-live-reload)", () => {
  const mockEventEmitter = eventEmitter as unknown as {
    on: ReturnType<typeof vi.fn>;
    removeListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    await serveHttp2();
  });

  /** Fires the registered "transpiled" event listener for /bascik-live-reload. */
  const fireTranspiled = (relativePagePath: string) => {
    const [, handler] = mockEventEmitter.on.mock.calls.find(
      (c: any[]) => c[0] === "transpiled",
    ) as [string, (arg: { relativePagePath: string }) => void];
    handler({ relativePagePath });
  };

  it("responds with content-type text/event-stream and sends a connected message", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/bascik-live-reload"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ "content-type": "text/event-stream" }),
    );
    expect(stream.write).toHaveBeenCalledWith("data: connected\n\n");
  });

  it("sends reload when Referer header is absent (regression: was silently dropped)", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    // No referer header — simulates Safari, privacy extensions, or no-referrer policy.
    await handler(stream, makeHeaders("/bascik-live-reload", "GET", "", undefined));
    fireTranspiled("pages/about.html");
    expect(stream.write).toHaveBeenCalledWith("data: reload\n\n");
  });

  it("sends reload when Referer matches the transpiled page", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/bascik-live-reload", "GET", "", "https://localhost:8443/about"));
    fireTranspiled("pages/about.html");
    expect(stream.write).toHaveBeenCalledWith("data: reload\n\n");
  });

  it("does not send reload when Referer is a different page than the one transpiled", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/bascik-live-reload", "GET", "", "https://localhost:8443/getting-started"));
    fireTranspiled("pages/about.html");
    const reloadCalls = stream.write.mock.calls.filter((c: any[]) => c[0] === "data: reload\n\n");
    expect(reloadCalls).toHaveLength(0);
  });

  it("removes event listeners when the SSE stream closes", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/bascik-live-reload"));
    // Trigger the stream close callback registered by the handler.
    const closeCallback = stream.on.mock.calls.find((c: any[]) => c[0] === "close")?.[1] as () => void;
    closeCallback?.();
    expect(mockEventEmitter.removeListener).toHaveBeenCalledWith("transpiled", expect.any(Function));
    expect(mockEventEmitter.removeListener).toHaveBeenCalledWith("asset-changed", expect.any(Function));
  });

  it("calls mem.trackOpenPage with the referer pathname when a connection opens", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/bascik-live-reload", "GET", "", "https://localhost:8443/faq"));
    expect(mockMem.trackOpenPage).toHaveBeenCalledWith("/faq");
  });

  it("calls mem.untrackOpenPage when the SSE stream closes", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/bascik-live-reload", "GET", "", "https://localhost:8443/faq"));
    const closeCallback = stream.on.mock.calls.find((c: any[]) => c[0] === "close")?.[1] as () => void;
    closeCallback?.();
    expect(mockMem.untrackOpenPage).toHaveBeenCalledWith("/faq");
  });

  it("does not call mem.trackOpenPage when there is no Referer header", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/bascik-live-reload", "GET", "", undefined));
    expect(mockMem.trackOpenPage).not.toHaveBeenCalled();
  });

  it("responds 404 in --serve mode (SSE only runs in dev)", async () => {
    const { BascikConfig } = await import("./config.js");
    (BascikConfig as any).isServe = true;
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/bascik-live-reload"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 404 }),
    );
    (BascikConfig as any).isServe = false;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// onError helper – header/end error paths
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – onError: stream already has headers sent", () => {
  beforeEach(async () => {
    await serveHttp2();
  });

  it("skips respond() when headersSent is true (headers already sent before exception)", async () => {
    const page = makePage({ content: Buffer.from("<html>Hi</html>") });
    mockMem.getPage.mockReturnValue(page);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    // First respond() call sets headersSent=true; stream.end() then throws,
    // causing the outer catch to invoke onError(), which must not call respond() again.
    stream.respond.mockImplementationOnce(() => {
      (stream as any).headersSent = true;
    });
    stream.end.mockImplementationOnce(() => { throw new Error("stream destroyed"); });
    await handler(stream, makeHeaders("/about", "GET"));
    // Only one respond() call (the page response); onError() must not add a second.
    expect(stream.respond).toHaveBeenCalledTimes(1);
  });

  it("responds 500 when stat throws a non-ENOENT error", async () => {
    const handler = getStreamHandler()!;
    mockStat.mockRejectedValueOnce(Object.assign(new Error("EPERM"), { code: "EPERM" }));
    const stream = makeStream();
    await handler(stream, makeHeaders("/style.css", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 500 }),
    );
    expect(stream.end).toHaveBeenCalledWith("Internal Server Error");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// fileStream error paths
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – fileStream error handling", () => {
  beforeEach(async () => {
    await serveHttp2();
  });

  it("does nothing when fileStream emits an error after the stream is destroyed", async () => {
    const fakeFileStream = { on: vi.fn().mockReturnThis(), pipe: vi.fn() };
    mockCreateReadStream.mockReturnValue(fakeFileStream);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    (stream as any).destroyed = true;

    await handler(stream, makeHeaders("/style.css", "GET"));
    const errorCb = fakeFileStream.on.mock.calls.find((c: any[]) => c[0] === "error")?.[1] as (err: Error) => void;
    // Must not throw even if the stream is already destroyed
    expect(() => errorCb?.(new Error("read error"))).not.toThrow();
    // respond() must not be called on a destroyed stream
    expect(stream.respond).not.toHaveBeenCalled();
  });

  it("closes stream via NGHTTP2_INTERNAL_ERROR when error occurs after headers sent", async () => {
    const mockClose = vi.fn();
    const fakeFileStream = { on: vi.fn().mockReturnThis(), pipe: vi.fn() };
    mockCreateReadStream.mockReturnValue(fakeFileStream);
    const handler = getStreamHandler()!;
    const stream = { ...makeStream(), close: mockClose, destroyed: false };

    await handler(stream, makeHeaders("/style.css", "GET"));

    // Simulate the "open" event so headers are sent, then simulate an error.
    const openCb = fakeFileStream.on.mock.calls.find((c: any[]) => c[0] === "open")?.[1] as () => void;
    openCb?.(); // This calls stream.respond() → headers sent
    (stream as any).headersSent = true;

    const errorCb = fakeFileStream.on.mock.calls.find((c: any[]) => c[0] === "error")?.[1] as (err: Error) => void;
    errorCb?.(new Error("pipe error"));
    expect(mockClose).toHaveBeenCalled();
  });

  it("responds 404 when ENOENT error occurs before headers are sent", async () => {
    const fakeFileStream = { on: vi.fn().mockReturnThis(), pipe: vi.fn() };
    mockCreateReadStream.mockReturnValue(fakeFileStream);
    const handler = getStreamHandler()!;
    const stream = makeStream();

    await handler(stream, makeHeaders("/style.css", "GET"));
    const errorCb = fakeFileStream.on.mock.calls.find((c: any[]) => c[0] === "error")?.[1] as (err: NodeJS.ErrnoException) => void;
    errorCb?.(Object.assign(new Error("not found"), { code: "ENOENT" }));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 404 }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// logAccess – various skip conditions
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – logAccess skip conditions", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });
    await serveHttp2();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("does not log access for the live-reload SSE path", async () => {
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/bascik-live-reload"));
    const accessLines = consoleSpy.mock.calls.filter(
      (c) => String(c[0]).includes("bascik-live-reload"),
    );
    expect(accessLines).toHaveLength(0);
  });

  it("logs access for ordinary page requests (logging.requests defaults to true)", async () => {
    const { BascikConfig } = await import("./config.js");
    (BascikConfig as any).devServer = { logging: { level: "info", requests: true } };
    mockMem.getPage.mockReturnValue(makePage());
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about", "GET"));
    const accessLines = consoleSpy.mock.calls.filter((c) =>
      String(c[0]).includes("GET") && String(c[0]).includes("/about"),
    );
    expect(accessLines.length).toBeGreaterThan(0);
  });

  it("skips logging when logging.requests is false", async () => {
    const { BascikConfig } = await import("./config.js");
    (BascikConfig as any).devServer = { logging: { level: "info", requests: false } };
    mockMem.getPage.mockReturnValue(makePage());
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about", "GET"));
    const accessLines = consoleSpy.mock.calls.filter((c) =>
      String(c[0]).includes("GET") && String(c[0]).includes("/about"),
    );
    expect(accessLines).toHaveLength(0);
    (BascikConfig as any).devServer = { logging: { level: "info", requests: true } };
  });

  it("uses serve.logging config when isServe is true", async () => {
    const { BascikConfig } = await import("./config.js");
    (BascikConfig as any).isServe = true;
    (BascikConfig as any).serve = { logging: { level: "info", requests: true } };
    mockMem.getPage.mockReturnValue(makePage());
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about", "GET"));
    const accessLines = consoleSpy.mock.calls.filter((c) =>
      String(c[0]).includes("GET"),
    );
    expect(accessLines.length).toBeGreaterThan(0);
    (BascikConfig as any).isServe = false;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Query-string stripping and trailing-slash page lookup
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – query string and trailing-slash routing", () => {
  beforeEach(async () => {
    await serveHttp2();
  });

  it("strips query string before looking up a page (path?q=1 → path)", async () => {
    const page = makePage({ relativePagePath: "pages/about.html" });
    mockMem.getPageExact.mockImplementation((p: string) =>
      p === "/about" ? page : undefined,
    );
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about?ref=nav", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 200 }),
    );
  });

  it("looks up trailing-slash variant when exact path has no match", async () => {
    const page = makePage({ relativePagePath: "pages/blog/index.html" });
    // Exact match for "/blog" fails, but "/blog/" succeeds
    mockMem.getPageExact.mockImplementation((p: string) =>
      p === "/blog/" ? page : undefined,
    );
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/blog", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 200 }),
    );
  });

  it("looks up path without trailing slash when trailing-slash path has no match", async () => {
    const page = makePage({ relativePagePath: "pages/about.html" });
    mockMem.getPageExact.mockImplementation((p: string) =>
      p === "/about" ? page : undefined,
    );
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/about/", "GET"));
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ ":status": 200 }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Static asset cache-control when cacheHttp is enabled
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – static asset cache-control (cacheHttp=true)", () => {
  beforeEach(async () => {
    const { BascikConfig } = await import("./config.js");
    (BascikConfig as any).cacheHttp = true;
    await serveHttp2();
  });

  afterEach(async () => {
    const { BascikConfig } = await import("./config.js");
    (BascikConfig as any).cacheHttp = false;
  });

  it("adds cache-control public + etag for static assets when cacheHttp is true", async () => {
    const fakeFileStream = { on: vi.fn().mockReturnThis(), pipe: vi.fn() };
    mockCreateReadStream.mockReturnValue(fakeFileStream);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/style.css", "GET"));
    const openCb = fakeFileStream.on.mock.calls.find((c: any[]) => c[0] === "open")?.[1] as () => void;
    openCb?.();
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({
        "cache-control": expect.stringContaining("public"),
        "etag": expect.any(String),
      }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Port-in-use: non-EADDRINUSE error causes rejection
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – port bind: non-EADDRINUSE error rejects", () => {
  afterEach(() => {
    mockServer.listen.mockImplementation(
      (_port: number, _hostname: string, cb?: () => void) => { cb?.(); },
    );
  });

  it("rejects the promise when the server emits a non-EADDRINUSE error on listen", async () => {
    mockServer.listen.mockImplementation(
      (_port: number, _hostname: string, _cb?: () => void) => {
        const [, errorHandler] = mockServer.once.mock.calls.at(-1) as [
          string,
          (err: NodeJS.ErrnoException) => void,
        ];
        const err = Object.assign(new Error("EACCES"), { code: "EACCES" });
        errorHandler(err);
      },
    );
    await expect(serveHttp2()).rejects.toThrow("EACCES");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Server scripts: hasServerScripts=true path
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – server-scripts execution", () => {
  beforeEach(async () => {
    await serveHttp2();
  });

  it("calls executeServerScripts and serves the result for pages with hasServerScripts=true", async () => {
    const { executeServerScripts } = await import("./server-scripts.js");
    const mockExecute = executeServerScripts as ReturnType<typeof vi.fn>;
    mockExecute.mockResolvedValueOnce("<p>Hello World</p>");

    const page = makePage({
      hasServerScripts: true,
      content: Buffer.from("<p>Hello {{name}}</p>"),
    });
    mockMem.getPage.mockReturnValue(page);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/greeting", "GET"));
    expect(mockExecute).toHaveBeenCalled();
    expect(stream.respond).toHaveBeenCalledWith(
      expect.objectContaining({ "cache-control": "private, no-store" }),
    );
  });

  it("passes query params, path, and request headers to executeServerScripts", async () => {
    const { executeServerScripts } = await import("./server-scripts.js");
    const mockExecute = executeServerScripts as ReturnType<typeof vi.fn>;
    mockExecute.mockResolvedValueOnce("<p>ok</p>");

    const page = makePage({ hasServerScripts: true, content: Buffer.from("ok") });
    mockMem.getPage.mockReturnValue(page);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/greeting?color=blue", "GET", "", undefined, { "x-test": "val" }));
    const [, ctx] = mockExecute.mock.calls[0] as [string, { path: string; searchParams: Record<string, string>; headers: Record<string, string> }];
    expect(ctx.path).toBe("/greeting");
    expect(ctx.searchParams).toMatchObject({ color: "blue" });
    expect(ctx.headers).toMatchObject({ "x-test": "val" });
  });

  it("returns HEAD with no body for server-script pages", async () => {
    const { executeServerScripts } = await import("./server-scripts.js");
    const mockExecute = executeServerScripts as ReturnType<typeof vi.fn>;
    mockExecute.mockResolvedValueOnce("<html>ok</html>");

    const page = makePage({ hasServerScripts: true, content: Buffer.from("ok") });
    mockMem.getPage.mockReturnValue(page);
    const handler = getStreamHandler()!;
    const stream = makeStream();
    await handler(stream, makeHeaders("/greeting", "HEAD"));
    expect(stream.end).toHaveBeenCalledWith(undefined);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom cert configuration error
// ─────────────────────────────────────────────────────────────────────────────

describe("serveHttp2 – custom cert config error", () => {
  it("throws when custom cert files are configured but missing", async () => {
    const { BascikConfig } = await import("./config.js");
    (BascikConfig as any).serve = {
      ...BascikConfig.serve,
      certFile: "custom-cert.pem",
      keyFile: "custom-key.pem",
    };
    const { access } = await import("node:fs/promises");
    (access as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ENOENT"));

    await expect(serveHttp2()).rejects.toThrow("Custom TLS certificate files");
    (BascikConfig as any).serve = { port: 8443, hostname: "localhost" };
    (access as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });
});

