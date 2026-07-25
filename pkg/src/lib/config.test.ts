import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// userConfig is mocked so config.ts can be imported without top-level await
vi.mock("./userConfig.js", () => ({
  bascikConfig: {},
  buildOverrideConfig: {},
}));

import { defaultConfig, BascikConfig } from "./config.js";

describe("defaultConfig", () => {
  it("has scopeScriptBlocks: true", () => {
    expect(defaultConfig.scopeScriptBlocks).toBe(true);
  });

  it("has all scopeAttribute keys set to true", () => {
    expect(defaultConfig.scopeAttribute.class).toBe(true);
    expect(defaultConfig.scopeAttribute.id).toBe(true);
    expect(defaultConfig.scopeAttribute.name).toBe(true);
  });

  it("has default directory paths", () => {
    // initBascikConfig shallow-copies defaultConfig so directory is mutated to absolute paths
    expect(defaultConfig.directory.pages).toMatch(/src[/\\]pages$/);
    expect(defaultConfig.directory.components).toMatch(/src[/\\]components$/);
  });

  it("has minifyStyles: true", () => {
    expect(defaultConfig.minifyStyles).toBe(true);
  });

  it("has obfuscateAttributeNames: true", () => {
    expect(defaultConfig.obfuscateAttributeNames).toBe(true);
  });

  it("has cacheHttp: false", () => {
    expect(defaultConfig.cacheHttp).toBe(false);
  });

  it("has verboseLogging: false", () => {
    expect(defaultConfig.verboseLogging).toBe(false);
  });

  it("has deduplicateCss: true", () => {
    expect(defaultConfig.deduplicateCss).toBe(true);
  });

  it("has skipTranspilingElementContents: [\"code\"]", () => {
    expect(defaultConfig.skipTranspilingElementContents).toEqual(["code"]);
  });
});

describe("BascikConfig", () => {
  it("is frozen (immutable)", () => {
    expect(Object.isFrozen(BascikConfig)).toBe(true);
  });

  it("contains all default keys", () => {
    expect(BascikConfig).toHaveProperty("scopeScriptBlocks");
    expect(BascikConfig).toHaveProperty("scopeAttribute");
    expect(BascikConfig).toHaveProperty("directory");
    expect(BascikConfig).toHaveProperty("minifyStyles");
    expect(BascikConfig).toHaveProperty("obfuscateAttributeNames");
    expect(BascikConfig).toHaveProperty("cacheHttp");
    expect(BascikConfig).toHaveProperty("verboseLogging");
    expect(BascikConfig).toHaveProperty("deduplicateCss");
    expect(BascikConfig).toHaveProperty("isBuild");
  });

  it("resolves directory paths to absolute paths", () => {
    expect(BascikConfig.directory.pages).toMatch(/[/\\]src[/\\]pages$/);
    expect(BascikConfig.directory.components).toMatch(
      /[/\\]src[/\\]components$/,
    );
  });
});

describe("BascikConfig.isBuild", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is false when BASCIK_BUILD is not set", async () => {
    vi.stubEnv("BASCIK_BUILD", "0");
    vi.resetModules();
    const mod = await import("./config.js");
    expect(mod.BascikConfig.isBuild).toBe(false);
  });

  it("is true when BASCIK_BUILD=1", async () => {
    vi.stubEnv("BASCIK_BUILD", "1");
    vi.resetModules();
    const mod = await import("./config.js");
    expect(mod.BascikConfig.isBuild).toBe(true);
  });

  it("is true when --build is in process.argv", async () => {
    const original = process.argv;
    process.argv = ["node", "bascik.js", "--build"];
    vi.resetModules();
    const mod = await import("./config.js");
    expect(mod.BascikConfig.isBuild).toBe(true);
    process.argv = original;
  });
});
