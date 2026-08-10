import { access } from "node:fs/promises";
import { resolve } from "node:path";
import type { BascikConfigOptions } from "./types.js";

type UserConfig = Partial<Omit<BascikConfigOptions, "isBuild">>;

const configPath = resolve(process.cwd(), "bascik.config.js");

export let bascikConfig: UserConfig = {};
export let buildOverrideConfig: UserConfig = {};

try {
  await access(configPath);
  try {
    // Dynamic import — async, non-blocking, native ESM
    const mod = (await import(configPath)) as {
      bascikConfig?: UserConfig;
      buildOverrideConfig?: UserConfig;
    };
    bascikConfig = mod.bascikConfig ?? {};
    buildOverrideConfig = mod.buildOverrideConfig ?? {};
  } catch (err) {
    console.error(`[bascik] Failed to load bascik.config.js:`, err);
    process.exit(1);
  }
} catch {
  console.warn("[bascik] No bascik.config.js found. Using defaults.");
}
