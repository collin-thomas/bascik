import fs from "node:fs";
import readline from "node:readline";

const createReadInterface = (filePath) => {
  return readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
};

const read = (filePath, fn) => {
  const readInterface = createReadInterface(filePath);
  return readInterface.on("line", (line) => fn(line));
};

export { read };
