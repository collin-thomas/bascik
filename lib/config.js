import { bascikConfig, buildOverrideConfig } from "../bascik.config.js";
const isBuild = parseInt(process.env.BASCIK_BUILD) === 1;

export const defaultConfig = {
  scopeScriptBlocks: true,
  scopeAttribute: {
    class: true,
    id: true,
    name: true,
  },
  minifyStyles: true,
  obfuscateAttributeNames: true,
  cacheHttp: false,
}

const initBascikConfig = (bascikConfig) => {
  const BascikConfig = {
    ...defaultConfig,
    ...bascikConfig,
    ...(isBuild ? buildOverrideConfig : {}),
    isBuild: isBuild
  };
  return { BascikConfig: Object.freeze(BascikConfig) };
};

export const { BascikConfig } = initBascikConfig(bascikConfig);
