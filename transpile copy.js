// This works
import { Transform } from "stream";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { pipeline } from "node:stream";
import ReadlineTransform from "./ReadlineTransform.js";

const componentNames = ["my-header", "my-footer"];

const replaceText = new Transform({
  async transform(chunk, encoding, callback) {
    const chunkStr = chunk.toString("utf8").trim();
    //componentNames.includes(chunkStr())
    //console.log(chunkStr, "-");
    this.push(chunkStr);
    callback();
  },
});

try {
  await stat("./dist");
} catch {
  await mkdir("./dist", { recursive: true });
}

const convertChunksToLines = new ReadlineTransform({
  skipEmpty: true,
  //breakMatcher: /<[^<>]+>/,
});

pipeline(
  // highWaterMark is in kb
  createReadStream("./pages/index.html", { highWaterMark: 10 }),
  //convertChunksToLines,
  replaceText,
  createWriteStream("./dist/index.html"),
  (err) => {
    if (err) {
      console.error("Pipeline failed.", err);
    } else {
      console.log("Pipeline succeeded.");
    }
  }
);
