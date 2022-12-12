// This works!
import { Transform } from "stream";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { pipeline } from "node:stream";

class ReplaceText extends Transform {
  constructor(char) {
    super();
    this.replaceChar = char;
  }

  _transform(chunk, encoding, callback) {
    const transformChunk = chunk.toString();
    //.replace(/[a-z]|[A-Z]/g, this.replaceChar);
    this.push(transformChunk);
    callback();
  }

  /* _flush(callback) {
    this.push("- DONE -");
    callback();
  } */
}

try {
  await stat("./dist");
} catch {
  await mkdir("./dist", { recursive: true });
}

const replaceTextTransformer = new ReplaceText("x");

pipeline(
  createReadStream("./pages/index.html"),
  replaceTextTransformer,
  createWriteStream("./dist/index.html"),
  (err) => {
    if (err) {
      console.error("Pipeline failed.", err);
    } else {
      console.log("Pipeline succeeded.");
    }
  }
);
