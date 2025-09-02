import { resolve } from 'path';
import { existsSync } from 'fs';
import { createRequire } from "module";

const require = createRequire(process.cwd());
const configPath = resolve(process.cwd(), 'bascik.config.js');
const userConfig = {};
if (existsSync(configPath)) {
  try {
    const { bascikConfig, buildOverrideConfig } = (require(configPath)) ?? {};
    userConfig.bascikConfig = bascikConfig
    userConfig.buildOverrideConfig = buildOverrideConfig
  } catch (err) {
    console.error(`[bascik] Failed to load bascik.config.js:`, err);
    process.exit(1);
  }
} else {
  console.warn('[bascik] No bascik.config.js found. Using defaults.');
}

export const { bascikConfig, buildOverrideConfig } = userConfig

