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
  inlineStyles: false,
};

const initBascikConfig = (
  userConfig: Partial<Omit<BascikConfigOptions, "isBuild">>,
) => {
  const { triggerTranspile: _removedTriggerTranspile, ...sanitizedUserConfig } =
    userConfig as Partial<Omit<BascikConfigOptions, "isBuild">> & {
      triggerTranspile?: string[];
    };
  const {
    triggerTranspile: _removedBuildOverrideTriggerTranspile,
    ...sanitizedBuildOverrideConfig
  } = buildOverrideConfig as Partial<Omit<BascikConfigOptions, "isBuild">> & {
    triggerTranspile?: string[];
  };
  const userDirectory: Partial<BascikConfigOptions["directory"]> =
    sanitizedUserConfig.directory ?? {};
  const buildDirectory: Partial<BascikConfigOptions["directory"]> =
    sanitizedBuildOverrideConfig.directory ?? {};
  const BascikConfig: BascikConfigOptions = {
    ...defaultConfig,
    ...sanitizedUserConfig,
    ...(isBuild ? sanitizedBuildOverrideConfig : {}),
    directory: {
      ...defaultConfig.directory,
      ...userDirectory,
      ...(isBuild ? buildDirectory : {}),
    },
    scopeAttribute: {
      ...defaultConfig.scopeAttribute,
      ...(sanitizedUserConfig.scopeAttribute ?? {}),
      ...(isBuild ? (sanitizedBuildOverrideConfig.scopeAttribute ?? {}) : {}),
    },
    generate: {
      ...defaultConfig.generate,
      ...(sanitizedUserConfig.generate ?? {}),
      ...(isBuild ? (sanitizedBuildOverrideConfig.generate ?? {}) : {}),
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
