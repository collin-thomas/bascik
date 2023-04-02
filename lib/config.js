import { config, prodOverride } from "../bascik.config.js";
const prod = parseInt(process.env.BASCIK_PROD) === 1;

const initBascikConfig = (config) => {
  const BascikConfig = {
    ...config,
    ...(prod && prodOverride ? prodOverride : {}),
  };
  return { BascikConfig: Object.freeze(BascikConfig) };
};

export const { BascikConfig } = initBascikConfig(config);
