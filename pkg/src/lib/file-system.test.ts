import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  deepReadDir,
  deepReadDirFlat,
  listPages,
  getDirectoryPath,
  getDistPagePath,
  deleteDistFile,
  deleteDistDir,
  createDir,
  copyReplicatePath,
} from "./file-system.js";
import { BascikConfig } from "./config.js";
import { readFile, writeFile } from "node:fs/promises";

const isDirMock = vi.fn().mockImplementation(() => false);

isDirMock.mockImplementationOnce(() => true);

vi.mock("./config.js", () => ({
  BascikConfig: {
    directory: {
      pages: "pages",
      components: "components",
    },
    minifyStyles: false,
    devServer: {
      logging: {
        level: "info",
        requests: true,
        copies: true,
        deletes: true,
        transpiles: true,
      },
    },
  },
  shouldLog: (configuredLevel: string | undefined, eventLevel = "info") => {
    const levels = ["silent", "error", "warn", "info", "debug"] as const;
    return (levels.indexOf((configuredLevel ?? "info") as any) >= levels.indexOf(eventLevel as any));
  },
}));

vi.mock("./styles.js", () => ({
  minifyCss: vi.fn((css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,])\s*/g, "$1").trim()),
}));

vi.mock("node:fs/promises", () => {
  return {
    readdir: vi.fn(async () => [
      {
        name: "./dir",
        isDirectory: isDirMock,
      },
      {
        name: "./dir/one.html",
        isDirectory: vi.fn(() => false),
      },
      {
        name: "./dir/one.css",
        isDirectory: vi.fn(() => false),
      },
    ]),
    rm: vi.fn(async () => undefined),
    mkdir: vi.fn(async () => undefined),
    readFile: vi.fn(),
    writeFile: vi.fn(async () => undefined),
    copyFile: vi.fn(async () => undefined),
  };
});

vi.spyOn(console, "log");

describe("deepReadDir", () => {
  it("Reads path", async () => {
    const paths = await deepReadDir("./");
    expect(paths).toEqual([
      ["dir/dir", "dir/dir/one.html", "dir/dir/one.css"],
      "dir/one.html",
      "dir/one.css",
    ]);
  });
});

describe("deepReadDirFlat", () => {
  it("reads path and flattens array", async () => {
    const paths = await deepReadDirFlat("./");
    expect(paths ?? []).toEqual(["dir", "dir/one.html", "dir/one.css"]);
  });
});

describe("listPages", () => {
  it("uses BascikConfig.directory.pages (not a hardcoded path)", async () => {
    const paths = await listPages();
    // Paths should be rooted at the configured pages directory ("pages"),
    // not at a hardcoded relative path.
    expect(paths.every((p) => p.startsWith("pages"))).toBe(true);
    expect(paths).toEqual(["pages/dir/one.html"]);
  });
});

describe("getDirectoryPath", () => {
  it("should return directory path for given page path", () => {
    const pagePath = "/pages/myPage.html";
    const expectedDirPath = "pages";
    const result = getDirectoryPath(pagePath);
    expect(result).toEqual(expectedDirPath);
  });

  it("should handle root page path", () => {
    const pagePath = "/index.html";
    const expectedDirPath = "";
    const result = getDirectoryPath(pagePath);
    expect(result).toEqual(expectedDirPath);
  });
});

describe("getDistPagePath", () => {
  it("should return dist page path for given page path", () => {
    const pagePath = "/pages/myPage.html";
    const expectedDistPath = "dist/pages/myPage.html";
    const result = getDistPagePath(pagePath);
    expect(result).toEqual(expectedDistPath);
  });

  it("should handle root page path", () => {
    const pagePath = "/index.html";
    const expectedDistPath = "dist/index.html";
    const result = getDistPagePath(pagePath);
    expect(result).toEqual(expectedDistPath);
  });
});

describe("deleteDistFile", () => {
  it("test", async () => {
    const pagePath = '"./test.js"';
    await deleteDistFile(pagePath);
    expect(console.log).toHaveBeenCalledWith(`deleted file: ${pagePath}`);
  });
});

describe("deleteDistDir", () => {
  it("test", async () => {
    const dirPath = '"./dir"';
    await deleteDistDir(dirPath);
    expect(console.log).toHaveBeenCalledWith(`deleted dir: ${dirPath}`);
  });
});

describe("createDir", () => {
  it("test", async () => {
    const dirPath = '"./dir"';
    expect(await createDir(dirPath)).toBe(undefined);
  });
});

describe("copyReplicatePath – CSS minification", () => {
  beforeEach(() => {
    vi.mocked(readFile).mockReset();
    vi.mocked(writeFile).mockReset();
    (BascikConfig as any).minifyStyles = true;
  });

  afterEach(() => {
    (BascikConfig as any).minifyStyles = false;
  });

  it("writes minified CSS to dest when source and dest hashes differ", async () => {
    const rawCss = "/* comment */\n.foo {\n  color: red;\n}";
    vi.mocked(readFile)
      .mockResolvedValueOnce(rawCss as any)          // read src
      .mockRejectedValueOnce(new Error("ENOENT"));   // read dest → does not exist yet

    await copyReplicatePath("pages/css/styles.css", "dist");

    expect(writeFile).toHaveBeenCalledOnce();
    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;
    expect(writtenContent).not.toContain("/* comment */");
    expect(writtenContent).not.toContain("\n");
    expect(writtenContent).toContain(".foo");
  });

  it("skips writeFile when minified content already matches dest", async () => {
    // The mock minifyCss strips comments and collapses whitespace;
    // if the dest already contains the minified form, hashes match → no write.
    const rawCss = ".foo { color: red; }";
    const alreadyMinified = ".foo{color:red;}";
    vi.mocked(readFile)
      .mockResolvedValueOnce(rawCss as any)          // src
      .mockResolvedValueOnce(alreadyMinified as any); // dest already up to date

    await copyReplicatePath("pages/css/styles.css", "dist");

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("uses writeFile (not copyFile) for CSS files when minifyStyles is enabled", async () => {
    const { copyFile } = await import("node:fs/promises");
    vi.mocked(readFile)
      .mockResolvedValueOnce(".a { color: red; }" as any)
      .mockRejectedValueOnce(new Error("ENOENT"));

    await copyReplicatePath("pages/css/styles.css", "dist");

    expect(writeFile).toHaveBeenCalledOnce();
    expect(copyFile).not.toHaveBeenCalled();
  });
});
