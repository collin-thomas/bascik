import { describe, expect, it, vi } from "vitest";
import {
  deepReadDir,
  deepReadDirFlat,
  listPages,
  getDirectoryPath,
  getDistPagePath,
  deleteDistFile,
  deleteDistDir,
  createDir,
} from "./file-system.js";

const isDirMock = vi.fn().mockImplementation(() => false);

isDirMock.mockImplementationOnce(() => true);

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
    expect(paths).toEqual(["dir", "dir/one.html", "dir/one.css"]);
  });
});

describe("listPages", () => {
  it("gets all html", async () => {
    const paths = await listPages();
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
    expect(console.log).toHaveBeenCalledWith(`deleted: ${pagePath}`);
  });
});

describe("deleteDistDir", () => {
  it("test", async () => {
    const dirPath = '"./dir"';
    await deleteDistDir(dirPath);
    expect(console.log).toHaveBeenCalledWith(`deleted: ${dirPath}`);
  });
});

describe("createDir", () => {
  it("test", async () => {
    const dirPath = '"./dir"';
    expect(await createDir(dirPath)).toBe(undefined);
  });
});
