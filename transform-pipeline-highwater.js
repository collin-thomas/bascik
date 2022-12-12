// This works
import { Transform } from "stream";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { pipeline } from "node:stream";

const replaceTextTransformer = new Transform({
  async transform(chunk, encoding, callback) {
    const transformChunk = chunk.toString();
    function w() {
      this.push(transformChunk);
      callback();
    }
    if (Math.random() < 0.2) {
      setTimeout(w.bind(this), 1000);
    } else {
      this.push(transformChunk);
      callback();
    }
  },
});

try {
  await stat("./dist");
} catch {
  await mkdir("./dist", { recursive: true });
}

pipeline(
  // highWaterMark is in kb
  createReadStream("./pages/index.html", { highWaterMark: 10 }),
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
