import { describe, it, expect, vi, afterEach } from "vitest";
import { resolve } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: userConfig.ts uses top-level await and a dynamic import().
// We use vi.doMock() (non-hoisted) + vi.resetModules() + dynamic import in
// each test to get a fresh module with controlled behaviour.
// ─────────────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("userConfig – no bascik.config.js", () => {
  it("exports empty bascikConfig when the file does not exist", async () => {
    vi.doMock("node:fs/promises", () => ({
      access: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
        ),
    }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const mod = await import("./userConfig.js");
    expect(mod.bascikConfig).toEqual({});
  });

  it("exports empty buildOverrideConfig when the file does not exist", async () => {
    vi.doMock("node:fs/promises", () => ({
      access: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
        ),
    }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.resetModules();
    const mod = await import("./userConfig.js");
    expect(mod.buildOverrideConfig).toEqual({});
  });
});

describe("userConfig – bascik.config.js exists", () => {
  it("loads bascikConfig and buildOverrideConfig from the file", async () => {
    const configPath = resolve(process.cwd(), "bascik.config.js");

    vi.doMock("node:fs/promises", () => ({
      access: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock(configPath, () => ({
      bascikConfig: { scopeScriptBlocks: false },
      buildOverrideConfig: { minifyStyles: false },
    }));

    vi.resetModules();
    const mod = await import("./userConfig.js");
    expect(mod.bascikConfig).toEqual({ scopeScriptBlocks: false });
    expect(mod.buildOverrideConfig).toEqual({ minifyStyles: false });
  });

  it("defaults missing exports to empty objects", async () => {
    const configPath = resolve(process.cwd(), "bascik.config.js");

    vi.doMock("node:fs/promises", () => ({
      access: vi.fn().mockResolvedValue(undefined),
    }));
    // Config file exists but exports nothing
    vi.doMock(configPath, () => ({}));

    vi.resetModules();
    const mod = await import("./userConfig.js");
    expect(mod.bascikConfig).toEqual({});
    expect(mod.buildOverrideConfig).toEqual({});
  });
});
