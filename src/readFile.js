const { once } = require("node:events");
const { createReadStream } = require("node:fs");
const { createInterface } = require("node:readline");

const readFile = async (filePath) => {
  try {
    const rl = createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      // Process the line.
      console.log(line);
    });

    await once(rl, "close");

    console.log("File processed.");
  } catch (err) {
    console.error(err);
  }
};

export { readFile };
