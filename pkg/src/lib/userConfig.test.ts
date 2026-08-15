import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// userConfig.ts loads via loadUserConfig() using a real dynamic import of a
// file:// URL.  We exercise it with real temp config files — mocking a file://
// specifier is unreliable, and a real file round-trip is the honest test.
// ─────────────────────────────────────────────────────────────────────────────

let dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  dirs = [];
});

const writeConfig = async (contents: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "bascik-cfg-"));
  dirs.push(dir);
  const p = join(dir, "bascik.config.js");
  await writeFile(p, contents, "utf8");
  return p;
};

describe("loadUserConfig", () => {
  it("loads bascikConfig and buildOverrideConfig from the file", async () => {
    const { loadUserConfig } = await import("./userConfig.js");
    const p = await writeConfig(
      `export const bascikConfig = { scopeScriptBlocks: false };
       export const buildOverrideConfig = { minifyStyles: false };`,
    );
    const { bascikConfig, buildOverrideConfig } = await loadUserConfig(p);
    expect(bascikConfig).toEqual({ scopeScriptBlocks: false });
    expect(buildOverrideConfig).toEqual({ minifyStyles: false });
  });

  it("defaults missing exports to empty objects", async () => {
    const { loadUserConfig } = await import("./userConfig.js");
    const p = await writeConfig(`export const somethingElse = 1;`);
    const { bascikConfig, buildOverrideConfig } = await loadUserConfig(p);
    expect(bascikConfig).toEqual({});
    expect(buildOverrideConfig).toEqual({});
  });

  it("returns empty config (with a warning) when the file does not exist", async () => {
    const { loadUserConfig } = await import("./userConfig.js");
    vi.spyOn(console, "warn").mockImplementation(() => { });
    const { bascikConfig } = await loadUserConfig("/nonexistent/bascik.config.js");
    expect(bascikConfig).toEqual({});
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("No bascik.config.js or bascik.config.ts found"),
    );
  });

  it("throws (not process.exit) when the config file fails to load", async () => {
    const { loadUserConfig } = await import("./userConfig.js");
    const p = await writeConfig(`this is not valid javascript {{{`);
    await expect(loadUserConfig(p)).rejects.toThrow(
      /Failed to load bascik\.config\.js/,
    );
  });

  it("imports via a file:// URL (Windows-safe)", async () => {
    // importUserConfig must convert to a file URL — importing a bare absolute
    // path fails with ERR_UNSUPPORTED_ESM_URL_SCHEME on Windows.
    const { importUserConfig } = await import("./userConfig.js");
    const p = await writeConfig(`export const bascikConfig = { cacheHttp: true };`);
    const mod = await importUserConfig(p);
    expect(mod.bascikConfig).toEqual({ cacheHttp: true });
  });
});

describe("resolveUserConfigPath", () => {
  const inTempCwd = async (fn: (dir: string) => Promise<void>): Promise<void> => {
    const dir = await mkdtemp(join(tmpdir(), "bascik-cfg-"));
    dirs.push(dir);
    const prevCwd = process.cwd();
    process.chdir(dir);
    try {
      await fn(dir);
    } finally {
      process.chdir(prevCwd);
    }
  };

  it("prefers bascik.config.js when both .js and .ts exist", async () => {
    const { resolveUserConfigPath } = await import("./userConfig.js");
    await inTempCwd(async (dir) => {
      await writeFile(join(dir, "bascik.config.js"), "export const bascikConfig = {};", "utf8");
      await writeFile(join(dir, "bascik.config.ts"), "export const bascikConfig = {};", "utf8");
      expect(await resolveUserConfigPath()).toMatch(/bascik\.config\.js$/);
    });
  });

  it("falls back to bascik.config.ts when no .js config exists", async () => {
    const { resolveUserConfigPath } = await import("./userConfig.js");
    await inTempCwd(async (dir) => {
      await writeFile(join(dir, "bascik.config.ts"), "export const bascikConfig = {};", "utf8");
      expect(await resolveUserConfigPath()).toMatch(/bascik\.config\.ts$/);
    });
  });

  it("returns the .js path when neither config exists (warning path)", async () => {
    const { resolveUserConfigPath } = await import("./userConfig.js");
    await inTempCwd(async () => {
      expect(await resolveUserConfigPath()).toMatch(/bascik\.config\.js$/);
    });
  });
});
