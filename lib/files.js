import { minifyHtml } from "./functions.js";
import { readdir, readFile } from "node:fs/promises";

/**
 *
 * @example const { components } = await createListofComponents();
 */
export const listComponents = async () => {
  const componentFileNames = await readdir("./components");
  const components = await Promise.all(
    componentFileNames.map(async (fileName) => {
      const name = fileName.substring(0, fileName.indexOf("."));
      const content = minifyHtml(
        (await readFile(`./components/${fileName}`)).toString()
      );
      return {
        name,
        fileName,
        content,
      };
    })
  );
  return components.reduce((acc, { name, ...rest }) => {
    acc[name] = rest;
    return acc;
  }, {});
};
