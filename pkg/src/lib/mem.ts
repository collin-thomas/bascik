import zlib from "node:zlib";
import { getHttpPath } from "./paths.js";
import { getRelativePath } from "./file-system.js";
import { htmlHasServerScripts } from "./server-scripts.js";
import type { StoredPage } from "./types.js";

interface StorePageArgs {
  relativePagePath: string;
  absolutePagePath: string;
  pageContent: string;
  usedComponentsNames?: string[];
}

class MemoryStore {
  #files: Map<string, StoredPage>;
  #components: Map<string, Set<string>>;
  /** HTTP paths of pages with an active SSE live-reload connection. */
  #openPages: Set<string>;

  constructor() {
    this.#files = new Map();
    this.#components = new Map();
    this.#openPages = new Set();
  }

  async storePage({
    relativePagePath,
    absolutePagePath,
    pageContent,
    usedComponentsNames = [],
  }: StorePageArgs): Promise<void> {
    const httpPath = getHttpPath(relativePagePath);

    //this.#files.set(httpPath, pageContent)
    const buffer = Buffer.from(pageContent, "utf8");

    const usedComponentsSet = new Set(usedComponentsNames);

    const originalUsedComponentSet = new Set(
      this.#files.get(httpPath)?.usedComponentsSet,
    );

    // Store the raw content immediately so the page is servable right away.
    // Brotli compression (quality 11 is CPU-heavy) is computed in the
    // background below and does not block "page ready" — the server falls
    // back to uncompressed content until compression finishes.
    this.#files.set(httpPath, {
      relativePagePath,
      absolutePagePath,
      content: buffer,
      compressedContent: undefined,
      usedComponentsSet,
      hasServerScripts: htmlHasServerScripts(pageContent),
    });

    // Invert map for reverse lookup to efficiently know what files to update
    // Create entries in the map for each component name,
    // and add this file to a Set associated with the component.
    usedComponentsSet.forEach((componentName: string) => {
      if (!this.#components.has(componentName)) {
        this.#components.set(componentName, new Set());
      }
      this.#components.get(componentName)!.add(absolutePagePath);
    });

    // If a page no longer has component, remove that page from the component's set.
    //  ex: pageA has tag1 and tag2. then tag2 is removed from pageA.
    // tag2 should remove pageA from it's set.
    originalUsedComponentSet
      .difference(usedComponentsSet)
      .forEach((unusedComponent: string) => {
        this.#components.get(unusedComponent)?.delete(absolutePagePath);
      });

    // Fire-and-forget: compress in the background and attach the result once
    // done. If the page has since been replaced or removed, discard the result.
    zlib.brotliCompress(buffer, (err, compressed) => {
      if (err) return;
      const current = this.#files.get(httpPath);
      if (current && current.content === buffer) {
        current.compressedContent = compressed;
      }
    });

    //console.log('stored page in memory:', httpPath)
  }

  getPage(httpPath: string): StoredPage | undefined {
    return this.#files.get(httpPath) || this.#files.get("/404");
  }

  /**
   * Exact lookup only — no 404 fallback.  Lets the HTTP layer try path
   * normalizations (`/blog` vs `/blog/`) before falling back to the 404 page.
   */
  getPageExact(httpPath: string): StoredPage | undefined {
    return this.#files.get(httpPath);
  }

  removePage(absolutePagePath: string): void {
    const relativePagePath = getRelativePath(absolutePagePath, "pages");
    const httpPath = getHttpPath(relativePagePath);

    // Remove page from components sets
    const page = this.#files.get(httpPath);
    if (!page) return;
    page.usedComponentsSet.forEach((componentName: string) => {
      this.#components.get(componentName)?.delete(absolutePagePath);
    });

    // Remove page from memory
    this.#files.delete(httpPath);
  }

  pagesThisComponentIsUsedOn(componentName: string): string[] {
    const pagesSet = this.#components.get(componentName);
    if (pagesSet) return [...pagesSet];
    return [];
  }

  trackOpenPage(httpPath: string): void {
    this.#openPages.add(httpPath);
  }

  untrackOpenPage(httpPath: string): void {
    this.#openPages.delete(httpPath);
  }

  get openPages(): string[] {
    return [...this.#openPages];
  }
}

export const mem = new MemoryStore();
