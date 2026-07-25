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
  },
  scopeScriptBlocks: true,
  scopeAttribute: {
    class: true,
    id: true,
    name: true,
  },
  skipTranspilingElementContents: ["code"],
  deduplicateCss: true,
  minifyStyles: true,
  obfuscateAttributeNames: true,
  cacheHttp: false,
  verboseLogging: false,
};

const initBascikConfig = (
  userConfig: Partial<Omit<BascikConfigOptions, "isBuild">>,
) => {
  const BascikConfig: BascikConfigOptions = {
    ...defaultConfig,
    ...userConfig,
    ...(isBuild ? buildOverrideConfig : {}),
    isBuild,
  };
  (
    Object.keys(BascikConfig.directory) as Array<
      keyof typeof BascikConfig.directory
    >
  ).forEach((key) => {
    BascikConfig.directory[key] = resolve(
      process.cwd(),
      BascikConfig.directory[key],
    );
  });
  return { BascikConfig: Object.freeze(BascikConfig) };
};

export const { BascikConfig } = initBascikConfig(bascikConfig ?? {});
