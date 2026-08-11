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
  minifyStyles: true,
  minifyScripts: true,
  obfuscateAttributeNames: true,
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

const initBascikConfig = (
  userConfig: Partial<Omit<BascikConfigOptions, "isBuild" | "isServe">>,
) => {
  const userDirectory: Partial<BascikConfigOptions["directory"]> =
    userConfig.directory ?? {};
  const buildDirectory: Partial<BascikConfigOptions["directory"]> =
    buildOverrideConfig.directory ?? {};
  const BascikConfig: BascikConfigOptions = {
    ...defaultConfig,
    ...(isServe ? serveDefaultConfig : {}),
    ...userConfig,
    ...(isBuild ? buildOverrideConfig : {}),
    directory: {
      ...defaultConfig.directory,
      ...userDirectory,
      ...(isBuild ? buildDirectory : {}),
    },
    scopeAttribute: {
      ...defaultConfig.scopeAttribute,
      ...(userConfig.scopeAttribute ?? {}),
      ...(isBuild ? (buildOverrideConfig.scopeAttribute ?? {}) : {}),
    },
    generate: {
      ...defaultConfig.generate,
      ...(userConfig.generate ?? {}),
      ...(isBuild ? (buildOverrideConfig.generate ?? {}) : {}),
    },
    serve: {
      ...defaultConfig.serve,
      ...(userConfig.serve ?? {}),
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
  return { BascikConfig: Object.freeze(BascikConfig) };
};

export const { BascikConfig } = initBascikConfig(bascikConfig ?? {});
