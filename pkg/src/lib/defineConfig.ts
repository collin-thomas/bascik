import type { BascikConfigOptions } from "./types.js";

// Partial on nested objects that config.ts deep-merges individually.
type UserConfig = Partial<
  Omit<BascikConfigOptions, "isBuild" | "directory" | "scopeAttribute" | "generate">
> & {
  directory?: Partial<BascikConfigOptions["directory"]>;
  scopeAttribute?: Partial<BascikConfigOptions["scopeAttribute"]>;
  generate?: Partial<BascikConfigOptions["generate"]>;
};

/** Public type for bascik.config.ts — use with `defineConfig`. */
export type BascikConfig = UserConfig;

/** Type helper for bascik.config.ts — wraps config in the correct type. */
export const defineConfig = (config: BascikConfig): BascikConfig => config;
