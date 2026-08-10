import { resolve } from "node:path";
import { bascikConfig, buildOverrideConfig } from "./userConfig.js";
import type { BascikConfigOptions } from "./types.js";

const args = process.argv.slice(2);
const isBuild =
  args.includes("--build") || parseInt(process.env.BASCIK_BUILD ?? "0") === 1;

export const defaultConfig: Omit<BascikConfigOptions, "isBuild"> = {
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
  triggerTranspile: [],
  inlineStyles: false,
};

const initBascikConfig = (
  userConfig: Partial<Omit<BascikConfigOptions, "isBuild">>,
) => {
  const legacyWatch = userConfig.triggerTranspile ?? [];
  const userDirectory: Partial<BascikConfigOptions["directory"]> =
    userConfig.directory ?? {};
  const buildDirectory: Partial<BascikConfigOptions["directory"]> =
    buildOverrideConfig.directory ?? {};
  const BascikConfig: BascikConfigOptions = {
    ...defaultConfig,
    ...userConfig,
    ...(isBuild ? buildOverrideConfig : {}),
    directory: {
      ...defaultConfig.directory,
      ...userDirectory,
      ...(legacyWatch.length && !(userDirectory.watch?.length ?? 0)
        ? { watch: legacyWatch }
        : {}),
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
    isBuild,
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
