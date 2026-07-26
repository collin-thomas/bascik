/**
 * @module check
 *
 * Static analysis for Bascik projects (`bascik --check`).
 *
 * Scans all pages and component files for:
 *  - Hyphenated tags that have no matching component file (errors)
 *  - Component files that are never referenced anywhere (warnings)
 *
 * Exits with code 1 when errors are found so it can gate CI pipelines.
 */
import { readFile } from "node:fs/promises";
import { listPages, getRelativePath } from "./file-system.js";
import { listComponents } from "./components.js";
import { BascikConfig } from "./config.js";
/**
 * Extract all hyphenated tag names from an HTML string.
 * HTML comments are stripped first to avoid false positives.
 */
export const extractCustomTags = (html) => {
    // Strip HTML comments so we don't match tags inside <!-- ... -->
    const stripped = html.replace(/<!--[\s\S]*?-->/g, "");
    const tags = new Set();
    const re = /<([a-z][a-z0-9]*(?:-[a-z0-9]+)+)[\s\/>]/gi;
    let m;
    while ((m = re.exec(stripped)) !== null) {
        tags.add(m[1].toLowerCase());
    }
    return tags;
};
/** Return a human-readable relative path for a file. */
const toDisplay = (filePath) => {
    try {
        if (filePath.includes(BascikConfig.directory.pages)) {
            return getRelativePath(filePath, "pages");
        }
        if (filePath.includes(BascikConfig.directory.components)) {
            return getRelativePath(filePath, "components");
        }
    }
    catch {
        // fall through
    }
    return filePath;
};
/**
 * Run the static check and print results to stdout/stderr.
 *
 * @returns `true` when no errors were found (warnings are still printed).
 *          Unused components are warnings only and do not affect the return value.
 */
export const checkProject = async () => {
    const [pages, componentList] = await Promise.all([
        listPages(),
        listComponents(),
    ]);
    const pageList = pages ?? [];
    const knownComponents = new Set(Object.keys(componentList));
    // Absolute paths to every component HTML file
    const componentFilePaths = Object.values(componentList)
        .map((c) => c.fileName)
        .filter((f) => Boolean(f));
    // Scan every page AND every component source file for hyphenated tags
    const allFilePaths = [...pageList, ...componentFilePaths];
    const scanResults = await Promise.all(allFilePaths.map(async (filePath) => {
        try {
            const html = await readFile(filePath, "utf8");
            return { filePath, tags: extractCustomTags(html) };
        }
        catch {
            return { filePath, tags: new Set() };
        }
    }));
    let hasErrors = false;
    const usedComponents = new Set();
    for (const { filePath, tags } of scanResults) {
        const unknown = [];
        for (const tag of tags) {
            if (knownComponents.has(tag)) {
                usedComponents.add(tag);
            }
            else {
                unknown.push(tag);
            }
        }
        if (unknown.length > 0) {
            console.error(`[bascik check] Unknown component${unknown.length > 1 ? "s" : ""} in "${toDisplay(filePath)}": ` +
                `${unknown.map((t) => `<${t}>`).join(", ")} — no matching component file found`);
            hasErrors = true;
        }
    }
    // Unused components are warnings, not errors — they don't break builds
    const unused = [...knownComponents].filter((c) => !usedComponents.has(c));
    if (unused.length > 0) {
        console.warn(`[bascik check] Unused component${unused.length > 1 ? "s" : ""}: ` +
            `${unused.map((c) => `<${c}>`).join(", ")} — defined but never referenced`);
    }
    if (!hasErrors) {
        const warnNote = unused.length > 0 ? ` (${unused.length} unused)` : "";
        console.log(`[bascik check] ✓ ${pageList.length} page${pageList.length !== 1 ? "s" : ""} ` +
            `and ${knownComponents.size} component${knownComponents.size !== 1 ? "s" : ""} checked — no errors${warnNote}`);
    }
    return !hasErrors;
};
//# sourceMappingURL=check.js.map