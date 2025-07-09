import zlib from "node:zlib";

class MemoryStore {
  #files;
  constructor() {
    this.#files = new Map()
  }

  #getHttpPath(pagePath) {
    return pagePath
      // Remove pages dir
      .replace(/^pages/, '')
      // Remove file ext
      .replace(/\.html$/, '')
      // If an index, remove file name, keep the slash for dir roots
      .replace(/\/index$/, '/')
  }

  addPage(pagePath, pageContent) {
    const httpPath = this.#getHttpPath(pagePath)

    //this.#files.set(httpPath, pageContent)
    const buffer = Buffer.from(pageContent, 'utf8');

    const br = zlib.brotliCompressSync(buffer);

    // More efficient to send Buffers to http2 stream.end()
    this.#files.set(httpPath, {
      content: buffer,
      compressedContent: br,
    });
    //console.debug('saved to memory:', httpPath)
  }

  getPage(httpPath) {
    return this.#files.get(httpPath) || this.#files.get('/404')
  }

  removePage(pagePath) {
    const httpPath = this.#getHttpPath(pagePath)
    this.#files.delete(httpPath)
  }
}

export const mem = new MemoryStore()