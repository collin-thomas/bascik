// This works!
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import readline from "node:readline";

await mkdir("./dist", { recursive: true });

function transform(line) {
  this.output.write(`modified ${line}\n`);
}

const readInterface = readline.createInterface({
  input: createReadStream("./pages/index.html"),
  output: createWriteStream("./dist/index.html"),
  terminal: false,
});

readInterface.on("line", transform).on("close", function () {
  console.log(`Created "${this.output.path}"`);
});
