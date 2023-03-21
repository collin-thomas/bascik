import { config } from "../bascik.config.js";

const initBascikConfig = (config) => {
  const BascikConfig = { ...config };

  BascikConfig.scopedStylesEnabled =
    BascikConfig?.scopedStyles?.classes || BascikConfig?.scopedStyles?.elements;

  return { BascikConfig: Object.freeze(BascikConfig) };
};

export const { BascikConfig } = initBascikConfig(config);
