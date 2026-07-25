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

export interface BascikConfigOptions {
  scopeScriptBlocks: boolean;
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
  };
  minifyStyles: boolean;
  obfuscateAttributeNames: boolean;
  cacheHttp: boolean;
  verboseLogging: boolean;
  /**
   * Tag names whose inner content is left untouched by the scoping pipeline.
   * Attribute values, element-selector class injection, and JS selector
   * rewriting are all skipped inside these elements.
   * Defaults to ["code", "pre"].
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
   * Extra directories or files to watch in dev mode. Any change inside these
   * paths triggers a full re-transpile of all pages, just like a component
   * change would. Has no effect during `bascik --build`.
   *
   * @example
   * triggerTranspile: ['scripts/', 'images/']
   */
  triggerTranspile?: string[];
  isBuild?: boolean;
}

export interface StoredPage {
  relativePagePath: string;
  absolutePagePath: string;
  content: Buffer;
  compressedContent: Buffer;
  usedComponentsSet: Set<string>;
}
