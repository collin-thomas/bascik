import { bascikConfig, productionOverrideConfig } from "../bascik.config.js";
const isProduction = parseInt(process.env.BASCIK_PRODUCTION) === 1;

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
    ...(isProduction && productionOverrideConfig ? productionOverrideConfig : {}),
    isBuild: isProduction
  };
  return { BascikConfig: Object.freeze(BascikConfig) };
};

export const { BascikConfig } = initBascikConfig(bascikConfig);
