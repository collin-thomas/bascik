import { resolve } from "node:path";
import { config, buildConfig } from "./userConfig.js";
import type { BascikConfigOptions } from "./types.js";

const args = process.argv.slice(2);
const isBuild =
  args.includes("--build") || parseInt(process.env.BASCIK_BUILD ?? "0") === 1;
const isProdServer =
  args.includes("--serve") || parseInt(process.env.BASCIK_PROD_SERVER ?? "0") === 1;

// Worker threads do not inherit the main thread's process.argv (they only see
// their own script path), but they DO inherit process.env. Propagate isBuild
// via the env var fallback above so worker threads compute the same isBuild
// value as the main thread — otherwise disk writes and other isBuild-gated
// behavior silently no-op inside every worker.
process.env.BASCIK_BUILD = isBuild ? "1" : "0";
process.env.BASCIK_PROD_SERVER = isProdServer ? "1" : "0";

// Applied on top of defaultConfig when --serve is active, before user config.
// This means production-appropriate settings are on by default; users can still
// override any of them in bascik.config.js.
const prodServerDefaultConfig: Partial<Omit<BascikConfigOptions, "isBuild" | "isProdServer">> = {
  cacheHttp: true,
};

// Applied on top of defaultConfig (and prodServerDefaultConfig) when --build is
// active, before user config. Minification and attribute-name obfuscation are
// production-only defaults: they slow down rebuilds and make debugging harder,
// so they stay off in dev but on for `bascik --build`. Users can still
// override any of them in bascik.config (or via the build export).
export const buildDefaultConfig: Partial<
  Omit<BascikConfigOptions, "isBuild" | "isProdServer">
> = {
  minifyStyles: true,
  minifyScripts: true,
  obfuscateAttributeNames: true,
};

export const defaultConfig: Omit<BascikConfigOptions, "isBuild" | "isProdServer"> = {
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
  generate: {
    sitemap: true,
    robots: true,
  },
  inlineStyles: false,
  useWorkers: false,
  buildScriptCache: true,
  devServer: {
    logging: {
      level: "info",
      requests: true,
      copies: true,
      deletes: true,
      transpiles: true,
    },
  },
  serve: {
    port: 8443,
    hostname: "localhost",
    logging: {
      level: "info",
      requests: true,
    },
  },
};

export const LOG_LEVELS = ["silent", "error", "warn", "info", "debug"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const shouldLog = (
  configuredLevel: LogLevel | undefined,
  eventLevel: LogLevel = "info",
  defaultLevel: LogLevel = "info",
): boolean => {
  const resolvedLevel = configuredLevel ?? defaultLevel;
  return LOG_LEVELS.indexOf(resolvedLevel) >= LOG_LEVELS.indexOf(eventLevel);
};

/**
 * Recursively freeze the config object. `Object.freeze` alone is shallow —
 * without this, nested objects (`directory`, `scopeAttribute`, `generate`,
 * `serve`) would remain mutable at runtime.
 */
const deepFreeze = <T>(value: T): Readonly<T> => {
  // Only freeze plain objects/arrays. Functions (e.g. a custom `minifyScripts`
  // implementation) are left untouched — freezing a function would break any
  // internal state it carries, and functions hold no mutable config values.
  if (
    value !== null &&
    typeof value !== "function" &&
    typeof value === "object" &&
    !Object.isFrozen(value)
  ) {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
};

type ConfigInput = Partial<
  Omit<BascikConfigOptions, "isBuild" | "isProdServer" | "directory" | "scopeAttribute" | "generate">
> & {
  directory?: Partial<BascikConfigOptions["directory"]>;
  scopeAttribute?: Partial<BascikConfigOptions["scopeAttribute"]>;
  generate?: Partial<BascikConfigOptions["generate"]>;
};

/**
 * Merge the layered configs into the final, frozen `BascikConfig`.
 *
 * Layer order (lowest → highest precedence):
 *   defaultConfig → (isProdServer ? prodServerDefaultConfig) → (isBuild ? buildDefaultConfig)
 *   → userConfig → ((isBuild || isProdServer) ? buildOverride)
 *
 * Exported (pure) so tests can exercise the merge logic directly without
 * relying on module-cache manipulation of the argv/env-derived singleton.
 */
export const initBascikConfig = (
  userConfig: ConfigInput,
  buildOverride: ConfigInput = {},
  flags: { isBuild?: boolean; isProdServer?: boolean } = {},
) => {
  const isBuild = flags.isBuild ?? false;
  const isProdServer = flags.isProdServer ?? false;
  const userDirectory: Partial<BascikConfigOptions["directory"]> =
    userConfig.directory ?? {};
  const buildDirectory: Partial<BascikConfigOptions["directory"]> =
    buildOverride.directory ?? {};
  const BascikConfig: BascikConfigOptions = {
    ...defaultConfig,
    ...(isProdServer ? prodServerDefaultConfig : {}),
    ...(isBuild ? buildDefaultConfig : {}),
    ...userConfig,
    ...((isBuild || isProdServer) ? buildOverride : {}),
    directory: {
      ...defaultConfig.directory,
      ...userDirectory,
      ...((isBuild || isProdServer) ? buildDirectory : {}),
    },
    scopeAttribute: {
      ...defaultConfig.scopeAttribute,
      ...(userConfig.scopeAttribute ?? {}),
      ...((isBuild || isProdServer) ? (buildOverride.scopeAttribute ?? {}) : {}),
    },
    generate: {
      ...defaultConfig.generate,
      ...(userConfig.generate ?? {}),
      ...((isBuild || isProdServer) ? (buildOverride.generate ?? {}) : {}),
    },
    devServer: {
      ...defaultConfig.devServer,
      ...(userConfig.devServer ?? {}),
      logging: {
        ...defaultConfig.devServer?.logging,
        ...(userConfig.devServer?.logging ?? {}),
      },
    },
    serve: {
      ...defaultConfig.serve,
      ...(userConfig.serve ?? {}),
      ...((isBuild || isProdServer) ? (buildOverride.serve ?? {}) : {}),
      logging: {
        ...defaultConfig.serve?.logging,
        ...((userConfig.serve ?? {}).logging ?? {}),
        ...((((isBuild || isProdServer) ? (buildOverride.serve ?? {}) : {}).logging) ?? {}),
      },
    },
    isBuild,
    isProdServer: isProdServer,
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
  config ?? {},
  buildConfig ?? {},
  { isBuild, isProdServer: isProdServer },
);
