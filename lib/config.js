import { config, prodOverride } from "../bascik.config.js";
const isBuild = parseInt(process.env.BASCIK_BUILD) === 1;

const initBascikConfig = (config) => {
  const BascikConfig = {
    ...config,
    ...(isBuild && prodOverride ? prodOverride : {}),
    isBuild
  };
  return { BascikConfig: Object.freeze(BascikConfig) };
};

export const { BascikConfig } = initBascikConfig(config);
