import type { BascikConfigOptions } from "./types.js";
type UserConfig = Partial<Omit<BascikConfigOptions, "isBuild">>;
export declare let bascikConfig: UserConfig;
export declare let buildOverrideConfig: UserConfig;
export {};
