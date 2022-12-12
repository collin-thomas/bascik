import fs from "node:fs";
import readline from "node:readline";

const createReadInterface = (filePath) => {
  //const fileHandle = await open(filePath)
  return readline.createInterface({
    //input: fileHandle.createReadStream(),
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
};

const fileRead = async (filePath, fn) => {
  const readInterface = createReadInterface(filePath);
  return readInterface.on("line", (line) => fn(line));
};

export { fileRead };
