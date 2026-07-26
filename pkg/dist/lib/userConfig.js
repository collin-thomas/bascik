import { access } from "node:fs/promises";
import { resolve } from "node:path";
const configPath = resolve(process.cwd(), "bascik.config.js");
export let bascikConfig = {};
export let buildOverrideConfig = {};
try {
    await access(configPath);
    try {
        // Dynamic import — async, non-blocking, native ESM
        const mod = (await import(configPath));
        bascikConfig = mod.bascikConfig ?? {};
        buildOverrideConfig = mod.buildOverrideConfig ?? {};
    }
    catch (err) {
        console.error(`[bascik] Failed to load bascik.config.js:`, err);
        process.exit(1);
    }
}
catch {
    console.warn("[bascik] No bascik.config.js found. Using defaults.");
}
//# sourceMappingURL=userConfig.js.map