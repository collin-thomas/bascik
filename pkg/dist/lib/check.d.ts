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
/**
 * Extract all hyphenated tag names from an HTML string.
 * HTML comments are stripped first to avoid false positives.
 */
export declare const extractCustomTags: (html: string) => Set<string>;
/**
 * Run the static check and print results to stdout/stderr.
 *
 * @returns `true` when no errors were found (warnings are still printed).
 *          Unused components are warnings only and do not affect the return value.
 */
export declare const checkProject: () => Promise<boolean>;
