// This works!
import { Transform } from "stream";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
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

const readStream = createReadStream("./pages/index.html");
const writeStream = createWriteStream("./dist/index.html");
writeStream.on("error", function (err) {
  console.log(err);
});
const replaceTextTransformer = new ReplaceText("x");
readStream.pipe(replaceTextTransformer).pipe(writeStream);
