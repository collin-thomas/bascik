/**
 * @module sitemap
 *
 * Sitemap and robots.txt Generation
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * When `generate.sitemap` and/or `generate.robots` are `true` (the defaults)
 * and `siteUrl` is configured, Bascik writes to `dist/` at the end of a build:
 *
 *   dist/sitemap.xml  — XML sitemap listing every HTML page
 *   dist/robots.txt   — robots directives pointing crawlers at the sitemap
 *
 * Only runs during `bascik --build`. The dev server does not generate these
 * files.
 *
 * @example bascik.config.js
 * ```js
 * export const bascikConfig = {
 *   siteUrl: 'https://example.com',
 *   generate: { sitemap: true, robots: true }, // both default to true
 * };
 * ```
 */
/**
 * Convert a relative page path (e.g. `pages/blog/post.html`) to an absolute
 * URL path (e.g. `/blog/post`) suitable for use in a sitemap.
 *
 * Rules:
 *  - Strip the leading `pages/` segment (already done via getRelativePath).
 *  - Strip the `.html` extension.
 *  - `/index` at the end of a path becomes `/`.
 *  - `index.html` at the root becomes `/`.
 */
export declare const pagePathToUrlPath: (relativePath: string) => string;
/**
 * Build the XML sitemap string from an array of URL paths.
 */
export declare const buildSitemapXml: (baseUrl: string, urlPaths: string[]) => string;
/**
 * Build the robots.txt string pointing at the sitemap.
 */
export declare const buildRobotsTxt: (baseUrl: string) => string;
/**
 * Generate `dist/sitemap.xml` and `dist/robots.txt`.
 *
 * Called by `processAllPages` at the end of a build. Skipped silently when
 * `generateSitemap` is `false` or `siteUrl` is not configured.
 */
export declare const generateSitemapFiles: () => Promise<void>;
