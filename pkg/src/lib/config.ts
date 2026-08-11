import { resolve } from "node:path";
import { bascikConfig, buildOverrideConfig } from "./userConfig.js";
import type { BascikConfigOptions } from "./types.js";

const args = process.argv.slice(2);
const isBuild =
  args.includes("--build") || parseInt(process.env.BASCIK_BUILD ?? "0") === 1;
const isServe =
  args.includes("--serve") || parseInt(process.env.BASCIK_SERVE ?? "0") === 1;

// Worker threads do not inherit the main thread's process.argv (they only see
// their own script path), but they DO inherit process.env. Propagate isBuild
// via the env var fallback above so worker threads compute the same isBuild
// value as the main thread — otherwise disk writes and other isBuild-gated
// behaviour silently no-op inside every worker.
process.env.BASCIK_BUILD = isBuild ? "1" : "0";
process.env.BASCIK_SERVE = isServe ? "1" : "0";

// Applied on top of defaultConfig when --serve is active, before user config.
// This means production-appropriate settings are on by default; users can still
// override any of them in bascik.config.js.
const serveDefaultConfig: Partial<Omit<BascikConfigOptions, "isBuild" | "isServe">> = {
  cacheHttp: true,
};

// Applied on top of defaultConfig (and serveDefaultConfig) when --build is
// active, before user config. Minification and attribute-name obfuscation are
// production-only defaults: they slow down rebuilds and make debugging harder,
// so they stay off in dev but on for `bascik --build`. Users can still
// override any of them in bascik.config.js (or via buildOverrideConfig).
export const buildDefaultConfig: Partial<
  Omit<BascikConfigOptions, "isBuild" | "isServe">
> = {
  minifyStyles: true,
  minifyScripts: true,
  obfuscateAttributeNames: true,
};

export const defaultConfig: Omit<BascikConfigOptions, "isBuild" | "isServe"> = {
  directory: {
    pages: "src/pages",
    components: "src/components",
    watch: [],
  },
  scopeScriptBlocks: true,
  inheritAttributes: true,
  scopeAttribute: {
    class: true,
    id: true,
    name: true,
  },
  skipTranspilingElementContents: ["code"],
  deduplicateCss: true,
  minifyStyles: false,
  minifyScripts: false,
  obfuscateAttributeNames: false,
  cacheHttp: false,
  verboseLogging: false,
  generate: {
    sitemap: true,
    robots: true,
  },
  inlineStyles: false,
  useWorkers: false,
  serve: {
    port: 8443,
    hostname: "localhost",
  },
};

/**
 * Recursively freeze the config object. `Object.freeze` alone is shallow —
 * without this, nested objects (`directory`, `scopeAttribute`, `generate`,
 * `serve`) would remain mutable at runtime.
 */
const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
};

type ConfigInput = Partial<Omit<BascikConfigOptions, "isBuild" | "isServe">>;

/**
 * Merge the layered configs into the final, frozen `BascikConfig`.
 *
 * Layer order (lowest → highest precedence):
 *   defaultConfig → (isServe ? serveDefaultConfig) → (isBuild ? buildDefaultConfig)
 *   → userConfig → (isBuild ? buildOverride)
 *
 * Exported (pure) so tests can exercise the merge logic directly without
 * relying on module-cache manipulation of the argv/env-derived singleton.
 */
export const initBascikConfig = (
  userConfig: ConfigInput,
  buildOverride: ConfigInput = {},
  flags: { isBuild?: boolean; isServe?: boolean } = {},
) => {
  const isBuild = flags.isBuild ?? false;
  const isServe = flags.isServe ?? false;
  const userDirectory: Partial<BascikConfigOptions["directory"]> =
    userConfig.directory ?? {};
  const buildDirectory: Partial<BascikConfigOptions["directory"]> =
    buildOverride.directory ?? {};
  const BascikConfig: BascikConfigOptions = {
    ...defaultConfig,
    ...(isServe ? serveDefaultConfig : {}),
    ...(isBuild ? buildDefaultConfig : {}),
    ...userConfig,
    ...(isBuild ? buildOverride : {}),
    directory: {
      ...defaultConfig.directory,
      ...userDirectory,
      ...(isBuild ? buildDirectory : {}),
    },
    scopeAttribute: {
      ...defaultConfig.scopeAttribute,
      ...(userConfig.scopeAttribute ?? {}),
      ...(isBuild ? (buildOverride.scopeAttribute ?? {}) : {}),
    },
    generate: {
      ...defaultConfig.generate,
      ...(userConfig.generate ?? {}),
      ...(isBuild ? (buildOverride.generate ?? {}) : {}),
    },
    serve: {
      ...defaultConfig.serve,
      ...(userConfig.serve ?? {}),
      ...(isBuild ? (buildOverride.serve ?? {}) : {}),
    },
    isBuild,
    isServe,
  };
  (["pages", "components"] as const).forEach((key) => {
    BascikConfig.directory[key] = resolve(
      process.cwd(),
      BascikConfig.directory[key],
    );
  });
  return { BascikConfig: deepFreeze(BascikConfig) };
};

export const { BascikConfig } = initBascikConfig(
  bascikConfig ?? {},
  buildOverrideConfig ?? {},
  { isBuild, isServe },
);
