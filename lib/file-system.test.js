import { describe, expect, it, vi } from "vitest";
import { deepReadDir } from "./file-system.js";

vi.mock("node:fs/promises", () => {
  return {
    readdir: vi.fn(async () => [
      {
        name: "./dir/one.js",
        isDirectory: vi.fn(() => false),
      },
      {
        name: "./dir/two.js",
        isDirectory: vi.fn(() => false),
      },
    ]),
  };
});

describe("deepReadDir", () => {
  it("test", async () => {
    const paths = await deepReadDir("./");
    expect(paths).toEqual(["dir/one.js", "dir/two.js"]);
  });
});
