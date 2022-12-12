// Long running tasks make the writes get out of order
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import readline from "node:readline";

try {
  await stat("./dist");
} catch {
  await mkdir("./dist", { recursive: true });
}

async function transform(line) {
  if (Math.random() < 0.2) {
    await setTimeout(() => {
      this.output.write(`timeout ${line}\n`);
    }, 1000);
  } else {
    this.output.write(`modified ${line}\n`);
  }
}

const readInterface = readline.createInterface({
  input: createReadStream("./pages/index.html"),
  output: createWriteStream("./dist/index.html"),
  terminal: false,
});

readInterface.on("line", transform).on("close", function () {
  console.log(`Created "${this.output.path}"`);
});
