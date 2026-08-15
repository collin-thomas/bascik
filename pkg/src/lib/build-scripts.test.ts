import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeBuildScripts } from "./build-scripts.js";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn(async () => { }),
  unlink: vi.fn(async () => { }),
  mkdir: vi.fn(async () => { }),
}));

vi.mock("./config.js", () => ({
  BascikConfig: {
    isBuild: false,
    directory: { pages: "src/pages", components: "src/components" },
  },
}));

import { execFile } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { BascikConfig } from "./config.js";

const mockExecFile = execFile as unknown as ReturnType<typeof vi.fn>;

// Helper: make execFile resolve with given stdout
// Signature: execFile(cmd, args, opts, cb) where cb = (err, stdout, stderr)
const resolveWith = (stdout: string) =>
  mockExecFile.mockImplementation(
    (
      _cmd: unknown,
      _args: unknown,
      _opts: unknown,
      cb: (err: null, stdout: string, stderr: string) => void,
    ) => {
      cb(null, stdout, "");
    },
  );

const rejectWith = (message: string) =>
  mockExecFile.mockImplementation(
    (
      _cmd: unknown,
      _args: unknown,
      _opts: unknown,
      cb: (err: Error) => void,
    ) => {
      cb(new Error(message));
    },
  );

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executeBuildScripts", () => {
  it("returns html unchanged when there are no data-bascik-build scripts", async () => {
    const html = "<p>no build scripts here</p>";
    const result = await executeBuildScripts(html);
    expect(result).toBe(html);
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("replaces a data-bascik-build script tag with script stdout", async () => {
    resolveWith("<h1>Generated heading</h1>\n");
    const html =
      "<header><script data-bascik-build>console.log('<h1>Generated heading</h1>');</script></header>";
    const result = await executeBuildScripts(html);
    expect(result).toContain("<h1>Generated heading</h1>");
    expect(result).not.toContain("data-bascik-build");
    expect(result).toContain("<header>");
  });

  it("writes the script content to a temp .mjs file", async () => {
    resolveWith("");
    const scriptContent = "console.log('hi');";
    await executeBuildScripts(
      `<script data-bascik-build>${scriptContent}</script>`,
    );
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.mjs$/),
      scriptContent,
      "utf8",
    );
  });

  it("writes temp scripts inside the project tree so ESM can resolve node_modules", async () => {
    resolveWith("");
    await executeBuildScripts("<script data-bascik-build>x</script>");
    const [tmpPath] = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(tmpPath).toMatch(process.cwd());
    expect(tmpPath).not.toMatch(/^\/tmp\//);
    expect(tmpPath).not.toMatch(/os\.tmpdir|bascik-build-scripts/);
  });

  it("removes the temp file after execution", async () => {
    resolveWith("output");
    await executeBuildScripts("<script data-bascik-build>x</script>");
    expect(unlink).toHaveBeenCalledTimes(1);
  });

  it("replaces the script tag with empty string on execution error", async () => {
    rejectWith("syntax error");
    const html =
      "<p>before</p><script data-bascik-build>bad code</script><p>after</p>";
    const result = await executeBuildScripts(html);
    expect(result).toContain("<p>before</p>");
    expect(result).toContain("<p>after</p>");
    expect(result).not.toContain("data-bascik-build");
  });

  it("still removes the temp file when execution fails", async () => {
    rejectWith("error");
    await executeBuildScripts("<script data-bascik-build>bad</script>");
    expect(unlink).toHaveBeenCalledTimes(1);
  });

  it("processes multiple build scripts in order", async () => {
    mockExecFile
      .mockImplementationOnce(
        (
          _cmd: unknown,
          _args: unknown,
          _opts: unknown,
          cb: (err: null, stdout: string, stderr: string) => void,
        ) => {
          cb(null, "<p>first</p>", "");
        },
      )
      .mockImplementationOnce(
        (
          _cmd: unknown,
          _args: unknown,
          _opts: unknown,
          cb: (err: null, stdout: string, stderr: string) => void,
        ) => {
          cb(null, "<p>second</p>", "");
        },
      );

    const html =
      "<script data-bascik-build>a</script><script data-bascik-build>b</script>";
    const result = await executeBuildScripts(html);
    expect(result).toContain("<p>first</p>");
    expect(result).toContain("<p>second</p>");
  });

  it("substitutes script output in place within a container element", async () => {
    resolveWith("<li>item-1</li><li>item-2</li>");
    const html = "<ul><script data-bascik-build>makeList()</script></ul>";
    const result = await executeBuildScripts(html);
    // Output should be inside <ul>, not after </ul>
    expect(result).toBe("<ul><li>item-1</li><li>item-2</li></ul>");
    expect(result).not.toMatch(/<\/ul>.*<li>/s);
  });

  it("substitutes script output in place within a deeply nested container", async () => {
    resolveWith("<p>Generated</p>");
    const html =
      '<aside class="sidebar"><nav><script data-bascik-build>gen()</script></nav></aside>';
    const result = await executeBuildScripts(html);
    expect(result).toBe('<aside class="sidebar"><nav><p>Generated</p></nav></aside>');
  });

  it("passes BASCIK_BUILD=0 to child process env when not in build mode", async () => {
    resolveWith("");
    (BascikConfig as { isBuild: boolean }).isBuild = false;
    await executeBuildScripts("<script data-bascik-build>x</script>");
    const opts = mockExecFile.mock.calls[0][2] as { env?: Record<string, string> };
    expect(opts.env?.BASCIK_BUILD).toBe("0");
  });

  it("passes BASCIK_BUILD=1 to child process env when in build mode", async () => {
    resolveWith("");
    (BascikConfig as { isBuild: boolean }).isBuild = true;
    await executeBuildScripts("<script data-bascik-build>x</script>");
    const opts = mockExecFile.mock.calls[0][2] as { env?: Record<string, string> };
    expect(opts.env?.BASCIK_BUILD).toBe("1");
  });

  it("passes a timeout to execFile so hung scripts don't hang the build", async () => {
    resolveWith("");
    await executeBuildScripts("<script data-bascik-build>x</script>");
    const opts = mockExecFile.mock.calls[0][2] as {
      timeout?: number;
      killSignal?: string;
    };
    expect(opts.timeout).toBeGreaterThan(0);
    expect(opts.killSignal).toBeTruthy();
  });

  it("handles a timeout kill gracefully: warns and removes the tag", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
    mockExecFile.mockImplementation(
      (
        _cmd: unknown,
        _args: unknown,
        _opts: unknown,
        cb: (err: Error & { killed?: boolean; signal?: string }) => void,
      ) => {
        // Simulate what execFile does on timeout: callback with a killed error
        cb(Object.assign(new Error("Command timed out"), {
          killed: true,
          signal: "SIGTERM",
        }));
      },
    );
    const html =
      "<p>before</p><script data-bascik-build>while(true){}</script><p>after</p>";
    const result = await executeBuildScripts(html);
    expect(result).toContain("<p>before</p>");
    expect(result).toContain("<p>after</p>");
    expect(result).not.toContain("data-bascik-build");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("matches a script tag when an attribute value contains `>`", async () => {
    resolveWith("<p>generated</p>");
    const html =
      '<script data-bascik-build data-x="a>b">gen()</script>';
    const result = await executeBuildScripts(html);
    expect(mockExecFile).toHaveBeenCalledTimes(1);
    expect(result).toBe("<p>generated</p>");
  });

  it("does NOT execute when data-bascik-build only appears inside an attribute value", async () => {
    const html =
      '<script data-desc="data-bascik-build">console.log("hi")</script>';
    const result = await executeBuildScripts(html);
    expect(mockExecFile).not.toHaveBeenCalled();
    expect(result).toBe(html);
  });

  it("does NOT execute when data-bascik-build appears inside a single-quoted attribute value", async () => {
    const html =
      "<script data-desc='data-bascik-build'>console.log('hi')</script>";
    const result = await executeBuildScripts(html);
    expect(mockExecFile).not.toHaveBeenCalled();
    expect(result).toBe(html);
  });

  it("replaces two identical build-script blocks each with their own output", async () => {
    mockExecFile
      .mockImplementationOnce(
        (
          _cmd: unknown,
          _args: unknown,
          _opts: unknown,
          cb: (err: null, stdout: string, stderr: string) => void,
        ) => {
          cb(null, "<p>first</p>", "");
        },
      )
      .mockImplementationOnce(
        (
          _cmd: unknown,
          _args: unknown,
          _opts: unknown,
          cb: (err: null, stdout: string, stderr: string) => void,
        ) => {
          cb(null, "<p>second</p>", "");
        },
      );

    const tag = "<script data-bascik-build>same()</script>";
    const result = await executeBuildScripts(`<div>${tag}</div><div>${tag}</div>`);
    expect(result).toBe("<div><p>first</p></div><div><p>second</p></div>");
  });

  it("handles `$` patterns in output safely with index splicing", async () => {
    resolveWith("price: $& and $1");
    const html = "<script data-bascik-build>x</script>";
    const result = await executeBuildScripts(html);
    expect(result).toBe("price: $& and $1");
  });

  it("strips ANSI color escape codes from script stdout before injecting HTML", async () => {
    resolveWith("\u001B[33m2026\u001B[39m Built with Bascik");
    const html = "<span>&copy; <script data-bascik-build>console.log(1)</script></span>";
    const result = await executeBuildScripts(html);
    expect(result).toBe("<span>&copy; 2026 Built with Bascik</span>");
  });

  it("forwards stderr output to process.stderr", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    mockExecFile.mockImplementation(
      (_cmd: unknown, _args: unknown, _opts: unknown,
        cb: (err: null, stdout: string, stderr: string) => void) => {
        cb(null, "<p>out</p>", "warning: something unusual");
      },
    );
    await executeBuildScripts("<script data-bascik-build>x</script>");
    expect(stderrSpy).toHaveBeenCalledWith("warning: something unusual");
    stderrSpy.mockRestore();
  });

  it("includes file path and line/column in the error message when filePath is provided", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
    rejectWith("syntax error");
    const html =
      '<p>first</p>\n<script data-bascik-build>bad()</script>';
    await executeBuildScripts(html, "src/pages/test-page.html");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("test-page.html"),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("line"),
    );
    warnSpy.mockRestore();
  });

  it("throws when both data-bascik-build and data-bascik-server are on the same tag", async () => {
    const html = "<script data-bascik-build data-bascik-server>x</script>";
    await expect(executeBuildScripts(html)).rejects.toThrow(
      /both data-bascik-build and data-bascik-server/,
    );
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("throws for both-attribute conflict regardless of attribute order", async () => {
    const html = "<script data-bascik-server data-bascik-build>x</script>";
    await expect(executeBuildScripts(html)).rejects.toThrow(
      /both data-bascik-build and data-bascik-server/,
    );
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it("includes file and line number in the both-attributes error", async () => {
    const html = '<p>intro</p>\n<script data-bascik-build data-bascik-server>x</script>';
    await expect(
      executeBuildScripts(html, "src/pages/my-page.html"),
    ).rejects.toThrow(
      expect.objectContaining({ message: expect.stringMatching(/my-page\.html.*line 2/) }),
    );
  });
});
