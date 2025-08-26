import { resolve } from 'path'
import { bascikConfig, buildOverrideConfig } from "./userConfig.js";

const args = process.argv.slice(2);
const isBuild = args.includes("--build") || parseInt(process.env.BASCIK_BUILD) === 1

export const defaultConfig = {
  scopeScriptBlocks: true,
  scopeAttribute: {
    class: true,
    id: true,
    name: true,
  },
  directory: {
    pages: 'src/pages',
    components: 'src/components'
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
  Object.keys(BascikConfig.directory).forEach(
    key => BascikConfig.directory[key] = resolve(process.cwd(), BascikConfig.directory[key])
  );
  return { BascikConfig: Object.freeze(BascikConfig) };
};

export const { BascikConfig } = initBascikConfig(bascikConfig);
