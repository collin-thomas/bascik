import { readdir } from "node:fs/promises";
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

/**
 *
 * @example const { components } = await createListofComponents();
 */
export const listComponents = async () => {
  const componentFileNames = await readdir("./components");
  const components = await Promise.all(
    componentFileNames.map(async (fileName) => {
      const name = fileName.substring(0, fileName.indexOf("."));
      const readInterface = createReadInterface(`./components/${fileName}`);
      return {
        fileName,
        name,
        readInterface,
      };
    })
  );
  return components.reduce((acc, { name, ...rest }) => {
    acc[name] = rest;
    return acc;
  }, {});
};
