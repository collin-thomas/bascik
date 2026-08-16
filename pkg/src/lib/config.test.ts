import { describe, it, expect, vi, afterEach } from "vitest";

// userConfig is mocked so config.ts can be imported without top-level await
vi.mock("./userConfig.js", () => ({
  config: {},
  buildConfig: {},
}));

import { defaultConfig, BascikConfig, initBascikConfig } from "./config.js";

describe("defaultConfig", () => {
  it("has scopeScriptBlocks: true", () => {
    expect(defaultConfig.scopeScriptBlocks).toBe(true);
  });

  it("has inheritAttributes: true", () => {
    expect(defaultConfig.inheritAttributes).toBe(true);
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
    expect(defaultConfig.watch).toEqual([]);
  });

  it("has minifyStyles: false (dev default — production default comes from buildDefaultConfig)", () => {
    expect(defaultConfig.minifyStyles).toBe(false);
  });

  it("has minifyScripts: false (dev default — production default comes from buildDefaultConfig)", () => {
    expect(defaultConfig.minifyScripts).toBe(false);
  });

  it("has obfuscateAttributeNames: false (dev default — production default comes from buildDefaultConfig)", () => {
    expect(defaultConfig.obfuscateAttributeNames).toBe(false);
  });

  it("has cacheHttp: false", () => {
    expect(defaultConfig.cacheHttp).toBe(false);
  });

  it("has default devServer logging options", () => {
    expect(defaultConfig.devServer?.logging?.level).toBe("info");
    expect(defaultConfig.devServer?.logging?.requests).toBe(true);
    expect(defaultConfig.devServer?.logging?.copies).toBe(true);
    expect(defaultConfig.devServer?.logging?.deletes).toBe(true);
    expect(defaultConfig.devServer?.logging?.transpiles).toBe(true);
  });

  it("has default serve logging options", () => {
    expect(defaultConfig.serve?.logging?.level).toBe("info");
    expect(defaultConfig.serve?.logging?.requests).toBe(true);
  });

  it("has deduplicateCss: true", () => {
    expect(defaultConfig.deduplicateCss).toBe(true);
  });

  it('has skipTranspilingElementContents: ["code"]', () => {
    expect(defaultConfig.skipTranspilingElementContents).toEqual(["code"]);
  });

  it("has inlineStyles: false", () => {
    expect(defaultConfig.inlineStyles).toBe(false);
  });

  it("has useWorkers: false", () => {
    expect(defaultConfig.useWorkers).toBe(false);
  });
});

describe("BascikConfig", () => {
  it("is frozen (immutable)", () => {
    expect(Object.isFrozen(BascikConfig)).toBe(true);
  });

  it("deep-freezes nested config objects", () => {
    expect(Object.isFrozen(BascikConfig.directory)).toBe(true);
    expect(Object.isFrozen(BascikConfig.scopeAttribute)).toBe(true);
    expect(Object.isFrozen(BascikConfig.generate)).toBe(true);
    expect(Object.isFrozen(BascikConfig.serve)).toBe(true);
    expect(Object.isFrozen(BascikConfig.watch)).toBe(true);
    expect(Object.isFrozen(BascikConfig.skipTranspilingElementContents)).toBe(
      true,
    );
  });

  it("throws when mutating a nested config key in strict mode", () => {
    expect(() => {
      (BascikConfig.directory as Record<string, unknown>).pages = "other";
    }).toThrow(TypeError);
  });

  it("contains all default keys", () => {
    expect(BascikConfig).toHaveProperty("scopeScriptBlocks");
    expect(BascikConfig).toHaveProperty("inheritAttributes");
    expect(BascikConfig).toHaveProperty("scopeAttribute");
    expect(BascikConfig).toHaveProperty("directory");
    expect(BascikConfig).toHaveProperty("minifyStyles");
    expect(BascikConfig).toHaveProperty("obfuscateAttributeNames");
    expect(BascikConfig).toHaveProperty("cacheHttp");
    expect(BascikConfig).toHaveProperty("deduplicateCss");
    expect(BascikConfig).toHaveProperty("devServer");
    expect(BascikConfig).toHaveProperty("isBuild");
  });

  it("resolves directory paths to absolute paths", () => {
    expect(BascikConfig.directory.pages).toMatch(/[/\\]src[/\\]pages$/);
    expect(BascikConfig.directory.components).toMatch(
      /[/\\]src[/\\]components$/,
    );
    expect(BascikConfig.watch).toEqual([]);
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

describe("dev vs build defaults", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("keeps minify/obfuscate off in dev mode", () => {
    const { BascikConfig: cfg } = initBascikConfig({}, {}, { isBuild: false });
    expect(cfg.minifyStyles).toBe(false);
    expect(cfg.minifyScripts).toBe(false);
    expect(cfg.obfuscateAttributeNames).toBe(false);
  });

  it("turns minify/obfuscate on by default for --build", () => {
    const { BascikConfig: cfg } = initBascikConfig({}, {}, { isBuild: true });
    expect(cfg.minifyStyles).toBe(true);
    expect(cfg.minifyScripts).toBe(true);
    expect(cfg.obfuscateAttributeNames).toBe(true);
  });

  it("applies build defaults through the singleton when BASCIK_BUILD=1", async () => {
    vi.stubEnv("BASCIK_BUILD", "1");
    vi.resetModules();
    const mod = await import("./config.js");
    expect(mod.BascikConfig.isBuild).toBe(true);
    expect(mod.BascikConfig.minifyStyles).toBe(true);
    expect(mod.BascikConfig.obfuscateAttributeNames).toBe(true);
  });

  it("exposes buildDefaultConfig with the production defaults", async () => {
    const { buildDefaultConfig } = await import("./config.js");
    expect(buildDefaultConfig.minifyStyles).toBe(true);
    expect(buildDefaultConfig.minifyScripts).toBe(true);
    expect(buildDefaultConfig.obfuscateAttributeNames).toBe(true);
  });
});

describe("user config overrides", () => {
  it("lets userConfig win over build defaults", () => {
    const { BascikConfig: cfg } = initBascikConfig(
      { minifyStyles: false, obfuscateAttributeNames: false },
      {},
      { isBuild: true },
    );
    expect(cfg.minifyStyles).toBe(false);
    expect(cfg.obfuscateAttributeNames).toBe(false);
    // Untouched build default still applies.
    expect(cfg.minifyScripts).toBe(true);
  });

  it("lets buildOverrideConfig win over userConfig during --build", () => {
    const { BascikConfig: cfg } = initBascikConfig(
      { minifyStyles: false },
      { minifyStyles: true },
      { isBuild: true },
    );
    expect(cfg.minifyStyles).toBe(true);
  });

  it("lets buildOverrideConfig win over userConfig during --serve", () => {
    const { BascikConfig: cfg } = initBascikConfig(
      { minifyStyles: false },
      { minifyStyles: true },
      { isProdServer: true },
    );
    expect(cfg.minifyStyles).toBe(true);
  });

  it("ignores buildOverrideConfig in dev mode", () => {
    const { BascikConfig: cfg } = initBascikConfig(
      { minifyStyles: false },
      { minifyStyles: true },
      { isBuild: false },
    );
    expect(cfg.minifyStyles).toBe(false);
  });
});

describe("buildOverrideConfig.serve merge", () => {
  it("merges buildOverrideConfig.serve over user serve config during --build", () => {
    const { BascikConfig: cfg } = initBascikConfig(
      { serve: { port: 9000, hostname: "example.test" } },
      { serve: { port: 443 } },
      { isBuild: true },
    );
    expect(cfg.serve?.port).toBe(443);
    // Keys not overridden by the build config keep the user value.
    expect(cfg.serve?.hostname).toBe("example.test");
  });

  it("merges buildOverrideConfig.serve over user serve config during --serve", () => {
    const { BascikConfig: cfg } = initBascikConfig(
      { serve: { port: 9000, hostname: "example.test" } },
      { serve: { port: 443 } },
      { isProdServer: true },
    );
    expect(cfg.serve?.port).toBe(443);
    expect(cfg.serve?.hostname).toBe("example.test");
  });

  it("does not apply buildOverrideConfig.serve in dev mode", () => {
    const { BascikConfig: cfg } = initBascikConfig(
      { serve: { port: 9000 } },
      { serve: { port: 443 } },
      { isBuild: false },
    );
    expect(cfg.serve?.port).toBe(9000);
  });

  it("merges devServer logging config from user config", () => {
    const { BascikConfig: cfg } = initBascikConfig({
      devServer: { logging: { level: "debug", requests: false, copies: false, transpiles: false } },
    });
    expect(cfg.devServer?.logging?.level).toBe("debug");
    expect(cfg.devServer?.logging?.requests).toBe(false);
    expect(cfg.devServer?.logging?.copies).toBe(false);
    expect(cfg.devServer?.logging?.transpiles).toBe(false);
    expect(cfg.devServer?.logging?.deletes).toBe(true);
  });

  it("falls back to the default serve config when nothing overrides it", () => {
    expect(BascikConfig.serve?.port).toBe(8443);
    expect(BascikConfig.serve?.hostname).toBe("localhost");
    expect(BascikConfig.serve?.logging?.level).toBe("info");
    expect(BascikConfig.serve?.logging?.requests).toBe(true);
  });
});
