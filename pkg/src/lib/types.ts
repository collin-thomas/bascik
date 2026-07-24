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
  directory: {
    pages: string;
    components: string;
  };
  minifyStyles: boolean;
  obfuscateAttributeNames: boolean;
  cacheHttp: boolean;
  verboseLogging: boolean;
  isBuild?: boolean;
}

export interface StoredPage {
  relativePagePath: string;
  absolutePagePath: string;
  content: Buffer;
  compressedContent: Buffer;
  usedComponentsSet: Set<string>;
}
