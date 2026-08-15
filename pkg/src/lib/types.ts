// Central TypeScript types for the Bascik transpile pipeline

export interface BascikComponent {
  name: string;
  /** Set during file loading; not required for in-test component objects */
  fileName?: string;
  fileContent: string;
  cssFileContent?: string;
  /** The full matched usage tag string from the page HTML, e.g. `<my-nav class="x">...</my-nav>` */
  content?: string;
  /** Inner HTML content from the usage site (slot content) */
  innerContent?: string;
  /** Position of the tag in the HTML string */
  index?: number;
}

export type ComponentList = Record<string, Omit<BascikComponent, "name">>;

export interface TranspileResult {
  transpiledHtmlBody: string;
  usedComponents: BascikComponent[];
}

export interface TranspilePageResult {
  relativePagePath: string;
  absolutePagePath: string;
  distHtml: string;
  usedComponentsNames: string[];
}
export interface BascikConfigOptions {
  scopeScriptBlocks: boolean;
  inheritAttributes: boolean;
  scopeAttribute: {
    class: boolean;
    id: boolean;
    name: boolean;
  };
  /**
   * When true (default), all instances of a component share the same scoped
   * class names so the compiled CSS is emitted only once per component type.
   * When false, each instance gets unique per-instance class names (the same
   * as `id` scoping) so JS class-selector queries naturally target only the
   * current instance, at the cost of one `<style>` block per instance.
   */
  deduplicateCss: boolean;
  directory: {
    pages: string;
    components: string;
    /**
     * Extra directories or files to watch in dev mode. Any change inside these
     * paths triggers a full re-transpile of all pages, just like a component
     * change would. Has no effect during `bascik --build`.
     *
     * @example
     * watch: ['scripts/', 'data/']
     */
    watch: string[];
  };
  minifyStyles: boolean;
  /**
   * Minify inline `<script>` content and `.js` static files in the output.
   *
   * - `false`  — no minification (default in dev)
   * - `true`   — built-in minifier: strips comments and collapses whitespace
   * - `(fn)`   — call the provided function for each script body; return the
   *              minified string.  Async functions are supported, which lets
   *              you plug in esbuild, terser, or any other tool:
   *
   * ```ts
   * // bascik.config.ts
   * import { transform } from 'esbuild';
   * export const build = {
   *   minifyScripts: async (js) => (await transform(js, { minify: true })).code,
   * };
   * ```
   */
  minifyScripts: boolean | ((code: string) => string | Promise<string>);
  obfuscateAttributeNames: boolean;
  cacheHttp: boolean;
  /**
   * Tag names whose inner content is left untouched by the scoping pipeline.
   * Attribute values, element-selector class injection, and JS selector
   * rewriting are all skipped inside these elements.
   * Defaults to ["code"].
   */
  skipTranspilingElementContents: string[];
  /**
   * Control which files are generated in `dist/` during `bascik --build`.
   */
  generate: {
    /**
     * Write `dist/sitemap.xml` listing every HTML page as an absolute URL.
     * Requires `siteUrl` to be set. Defaults to `true`.
     */
    sitemap: boolean;
    /**
     * Write `dist/robots.txt` allowing all crawlers and pointing at the sitemap.
     * Defaults to `true`.
     */
    robots: boolean;
  };
  /**
   * The canonical base URL of the deployed site (e.g. `"https://example.com"`).
   * Required for sitemap generation. Trailing slash is trimmed automatically.
   */
  siteUrl?: string;
  /**
  * Stylesheets to inline into every page's `<head>` during transpilation.
  *
  * - `false` (default) — do not inline any global stylesheets.
  * - `true` — inline every `.css` file under `directory.pages`.
  * - `string[]` — inline only the listed stylesheet paths (relative to the
  *   project root).
  *
   * When `minifyStyles` is true the content is minified before injection.
  * Global styles are injected before component styles so component rules take
  * precedence.
   *
   * @example
   * inlineStyles: ['src/pages/css/styles.css']
   */
  inlineStyles?: boolean | string[];
  /**
   * Transpile pages across a pool of CPU-core worker threads instead of
   * sequentially on the main thread. Defaults to `false`.
   *
   * Spinning up the pool has a fixed cost (loading the transpiler's module
   * graph into each worker thread, roughly 200-300ms total the first time,
   * in parallel across workers) before any page can be processed. For small
   * sites, or sites without expensive `<script data-bascik-build>` blocks,
   * this fixed cost outweighs the parallelism benefit and sequential
   * transpilation on the main thread is faster overall.
   *
   * Enable this for larger sites (dozens of pages) or sites with slow
   * per-page work (e.g. build scripts that fetch data or run markdown
   * rendering), where spreading pages across CPU cores pays for itself.
   *
   * @example
   * export const bascikConfig = { useWorkers: true };
   */
  useWorkers?: boolean;
  /**
   * Enable the persistent disk cache for `<script data-bascik-build>` output.
   * Cached results are stored in `node_modules/.cache/bascik/script-cache/`.
   * The cache key covers the script content, dev/build mode, the current page
   * path, the site URL, and the content of any `content/` or `scripts/` files
   * whose quoted path literals appear in the script — so the cache
   * self-invalidates when those tracked inputs change. Only files under those
   * directories with `.md`, `.mjs`, `.js`, or `.ts` extensions are detected;
   * other file reads are not tracked by the cache key.
   *
   * Defaults to `true`. Set to `false` to disable (e.g. when debugging a script
   * that reads external data not tracked by the cache key).
   *
   * To bust the entire cache manually:
   * `rm -rf node_modules/.cache/bascik/script-cache`
   *
   * @example
   * export const bascikConfig = { buildScriptCache: false };
   */
  buildScriptCache?: boolean;
  isBuild?: boolean;
  isProdServer?: boolean;
  /**
   * Development server logging controls. These are separate from the normal
   * `console.warn`/`console.error` diagnostics and only affect the high-traffic
   * "transpiled/copied/deleted" status lines that can get noisy during active
   * development.
   *
   * @example
   * export const bascikConfig = {
   *   devServer: {
   *     logging: {
   *       level: 'debug',
   *       copies: true,
   *       deletes: true,
   *       transpiles: true,
   *     },
   *   },
   * };
   */
  devServer?: {
    logging?: {
      /** `silent` | `error` | `warn` | `info` | `debug` */
      level?: "silent" | "error" | "warn" | "info" | "debug";
      /** Log HTTP requests served by the dev server. Defaults to `true`. */
      requests?: boolean;
      /** Log static-file copies into `dist/`. Defaults to `true`. */
      copies?: boolean;
      /** Log deletions from `dist/`. Defaults to `true`. */
      deletes?: boolean;
      /** Log page transpile events. Defaults to `true`. */
      transpiles?: boolean;
    };
  };
  /**
   * HTTP server configuration used in both dev and production (`bascik --serve`) modes.
   *
   * @example
   * // bascik.config.js
   * export const bascikConfig = {
   *   serve: {
   *     port: 443,
   *     hostname: '0.0.0.0',
   *     keyFile: '/etc/ssl/private/site.key',
   *     certFile: '/etc/ssl/certs/site.crt',
   *     logging: { level: 'warn', requests: false },
   *   },
   * };
   */
  serve?: {
    /** Port to listen on. Defaults to `8443`. */
    port?: number;
    /**
     * Hostname or IP to bind to. Use `"0.0.0.0"` to listen on all interfaces
     * (required when running in a container or behind a proxy). Defaults to
     * `"localhost"`.
     */
    hostname?: string;
    /** Path to a TLS private-key file (PEM). Auto-generated when omitted. */
    keyFile?: string;
    /** Path to a TLS certificate file (PEM). Auto-generated when omitted. */
    certFile?: string;
    /**
     * Maximum execution time (ms) for each `data-bascik-server` child process.
     * Scripts that exceed this deadline are killed and their output is dropped.
     * Defaults to `30000` (30 s).
     */
    scriptTimeout?: number;
    logging?: {
      /** `silent` | `error` | `warn` | `info` | `debug` */
      level?: "silent" | "error" | "warn" | "info" | "debug";
      /** Log HTTP requests served by the production server. Defaults to `true`. */
      requests?: boolean;
    };
  };
}

export interface StoredPage {
  relativePagePath: string;
  absolutePagePath: string;
  content: Buffer;
  // Computed asynchronously in the background; undefined until brotli
  // compression finishes, in which case the server serves uncompressed.
  compressedContent: Buffer | undefined;
  usedComponentsSet: Set<string>;
  /** True when the stored HTML contains `data-bascik-server` script blocks. */
  hasServerScripts: boolean;
}
