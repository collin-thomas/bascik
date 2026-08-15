import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { BascikConfigOptions } from "./types.js";

// Partial on nested objects that config.ts deep-merges individually.
type UserConfig = Partial<
  Omit<BascikConfigOptions, "isBuild" | "directory" | "scopeAttribute" | "generate">
> & {
  directory?: Partial<BascikConfigOptions["directory"]>;
  scopeAttribute?: Partial<BascikConfigOptions["scopeAttribute"]>;
  generate?: Partial<BascikConfigOptions["generate"]>;
};

/** Public type for bascik.config.ts — use with `defineConfig`. */
export type BascikConfig = UserConfig;

/** Type helper for bascik.config.ts — wraps config in the correct type. */
export const defineConfig = (config: BascikConfig): BascikConfig => config;

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

/** Load and validate the project's bascik.config.js, if present. */
export const loadUserConfig = async (
  configPath: string,
): Promise<{ bascikConfig: UserConfig; buildOverrideConfig: UserConfig }> => {
  try {
    await access(configPath);
    const mod = await importUserConfig(configPath);
    return {
      bascikConfig: mod.bascikConfig ?? {},
      buildOverrideConfig: mod.buildOverrideConfig ?? {},
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      console.warn("[bascik] No bascik.config.js found. Using defaults.");
      return { bascikConfig: {}, buildOverrideConfig: {} };
    }
    // A config file that exists but fails to load is fatal — throw (rather
    // than process.exit) so the CLI can surface the error and library
    // consumers (worker threads) don't nuke the whole process.
    throw new Error(
      `[bascik] Failed to load bascik.config.js: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
};

const jsPath = resolve(process.cwd(), "bascik.config.js");
const configPath = await access(jsPath).then(() => jsPath, () => resolve(process.cwd(), "bascik.config.ts"));
const loaded = await loadUserConfig(configPath);

export let bascikConfig: UserConfig = loaded.bascikConfig;
export let buildOverrideConfig: UserConfig = loaded.buildOverrideConfig;
