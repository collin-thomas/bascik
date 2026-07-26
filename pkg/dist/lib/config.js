import { resolve } from "node:path";
import { bascikConfig, buildOverrideConfig } from "./userConfig.js";
const args = process.argv.slice(2);
const isBuild = args.includes("--build") || parseInt(process.env.BASCIK_BUILD ?? "0") === 1;
export const defaultConfig = {
    directory: {
        pages: "src/pages",
        components: "src/components",
    },
    scopeScriptBlocks: true,
    scopeAttribute: {
        class: true,
        id: true,
        name: true,
    },
    skipTranspilingElementContents: ["code"],
    deduplicateCss: true,
    minifyStyles: true,
    obfuscateAttributeNames: true,
    cacheHttp: false,
    verboseLogging: false,
    generate: {
        sitemap: true,
        robots: true,
    },
    triggerTranspile: [],
};
const initBascikConfig = (userConfig) => {
    const BascikConfig = {
        ...defaultConfig,
        ...userConfig,
        ...(isBuild ? buildOverrideConfig : {}),
        isBuild,
    };
    Object.keys(BascikConfig.directory).forEach((key) => {
        BascikConfig.directory[key] = resolve(process.cwd(), BascikConfig.directory[key]);
    });
    return { BascikConfig: Object.freeze(BascikConfig) };
};
export const { BascikConfig } = initBascikConfig(bascikConfig ?? {});
//# sourceMappingURL=config.js.map