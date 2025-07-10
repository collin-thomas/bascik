import zlib from "node:zlib";
import { getHttpPath } from "./paths.js";
class MemoryStore {
  #files;
  #components;
  constructor() {
    this.#files = new Map()
    this.#components = new Map()
  }

  storePage(pagePath, pageContent, usedComponentsNames = []) {
    const httpPath = getHttpPath(pagePath)

    //this.#files.set(httpPath, pageContent)
    const buffer = Buffer.from(pageContent, 'utf8');

    const br = zlib.brotliCompressSync(buffer);

    const usedComponentsSet = new Set(usedComponentsNames)

    const originalUsedComponentSet = new Set(this.#files.get(httpPath)?.usedComponentsSet)

    // More efficient to send Buffers to http2 stream.end()
    this.#files.set(httpPath, {
      content: buffer,
      compressedContent: br,
      usedComponentsSet,
    });

    // Invert map for reverse lookup to efficiently know what files to update  
    // Create entries in the map for each component name, 
    // and add this file to a Set associated with the component.
    usedComponentsSet.forEach(componentName => {
      if (!this.#components.has(componentName)) {
        this.#components.set(componentName, new Set())
      }
      this.#components.get(componentName).add(pagePath)
    })

    // If a page no longer has component, remove that page from the component's set.
    //  ex: pageA has tag1 and tag2. then tag2 is removed from pageA.
    // tag2 should remove pageA from it's set.
    originalUsedComponentSet.difference(usedComponentsSet).forEach(unusedComponent => {
      this.#components.get(unusedComponent).delete(pagePath)
    })

    //console.log('stored page in memory:', httpPath)
  }

  getPage(httpPath) {
    return this.#files.get(httpPath) || this.#files.get('/404')
  }

  removePage(pagePath) {
    const httpPath = getHttpPath(pagePath)

    // Remove page from components sets
    const { usedComponentsSet } = this.#files.get(httpPath)
    usedComponentsSet.forEach(componentName => {
      this.#components.get(componentName).delete(pagePath)
    })

    // Remove page from memory
    this.#files.delete(httpPath)
  }

  pagesThisComponentIsUsedOn(componentName) {
    const pagesSet = this.#components.get(componentName)
    if (pagesSet) return [...pagesSet]
    return []
  }
}

export const mem = new MemoryStore()