import { access } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { BascikConfigOptions } from "./types.js";

type UserConfig = Partial<Omit<BascikConfigOptions, "isBuild">>;

export interface UserConfigModule {
  bascikConfig?: UserConfig;
  buildOverrideConfig?: UserConfig;
}

/**
 * Import a user config module.  Node ESM requires a file:// URL for absolute
 * paths — importing a bare absolute path fails on Windows
 * (ERR_UNSUPPORTED_ESM_URL_SCHEME).  Exported so tests can spy on the
 * import seam without needing to mock a file:// specifier.
 */
export const importUserConfig = async (
  configPath: string,
): Promise<UserConfigModule> => {
  return (await import(pathToFileURL(configPath).href)) as UserConfigModule;
};

/** Load and validate the project's bascik.config.js / bascik.config.ts, if present. */
export const loadUserConfig = async (
  configPath: string,
): Promise<{ bascikConfig: UserConfig; buildOverrideConfig: UserConfig }> => {
  const configName = basename(configPath);
  try {
    await access(configPath);
    const mod = await importUserConfig(configPath);
    return {
      bascikConfig: mod.bascikConfig ?? {},
      buildOverrideConfig: mod.buildOverrideConfig ?? {},
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      console.warn("[bascik] No bascik.config.js or bascik.config.ts found. Using defaults.");
      return { bascikConfig: {}, buildOverrideConfig: {} };
    }
    // A config file that exists but fails to load is fatal — throw (rather
    // than process.exit) so the CLI can surface the error and library
    // consumers (worker threads) don't nuke the whole process.
    throw new Error(
      `[bascik] Failed to load ${configName}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
};

/**
 * Resolve the project's config file path.  `bascik.config.js` takes precedence;
 * `bascik.config.ts` is used as a fallback (Node ≥ 24 imports TypeScript
 * natively via type stripping).  When neither exists, the `.js` path is
 * returned so loadUserConfig emits its "using defaults" warning.
 */
export const resolveUserConfigPath = async (): Promise<string> => {
  const jsPath = resolve(process.cwd(), "bascik.config.js");
  try {
    await access(jsPath);
    return jsPath;
  } catch { /* fall through to .ts */ }
  const tsPath = resolve(process.cwd(), "bascik.config.ts");
  try {
    await access(tsPath);
    return tsPath;
  } catch { /* neither exists — default to .js for the warning path */ }
  return jsPath;
};

const loaded = await loadUserConfig(await resolveUserConfigPath());

export let bascikConfig: UserConfig = loaded.bascikConfig;
export let buildOverrideConfig: UserConfig = loaded.buildOverrideConfig;
