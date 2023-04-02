import { readdir, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const listPages = async () => {
  return deepReadDirFlat("./pages", /\.html$/);
};

// Taken from https://stackoverflow.com/a/71166133/1469690
export const deepReadDir = async (dirPath) => {
  try {
    // withFileTypes is what makes it return dirent
    const dir = await readdir(dirPath, { withFileTypes: true });
    return Promise.all(
      dir.map(async (dirent) => {
        const path = join(dirPath, dirent.name);
        return dirent.isDirectory() ? await deepReadDir(path) : path;
      })
    );
  } catch (error) {
    //console.error(error);
    return [];
  }
};

/**
 *
 * @param {String} dirPath
 * @param {RegExp} filter
 * @returns
 */
export const deepReadDirFlat = async (dirPath, filter) => {
  const files = (await deepReadDir(dirPath)).flat(Number.POSITIVE_INFINITY);
  if (!filter) return files;
  return files.filter((filePath) => `${filePath}`.match(filter));
};

export const getDirectoryPath = (pagePath) => {
  return pagePath.split("/").slice(1, -1).join("/");
};

export const getDistPagePath = (pagePath) => {
  const pathParts = pagePath.split("/");
  pathParts[0] = "dist";
  return pathParts.join("/");
};

export const deleteDistFile = async (pagePath) => {
  try {
    const distPagePath = getDistPagePath(pagePath);
    await rm(distPagePath);
    console.log(`deleted: ${pagePath}`);
  } catch (error) {
    console.warn(error);
  }
};

export const deleteDistDir = async (dirPath) => {
  try {
    const distDirPath = dirPath.replace("pages", "dist");
    // recursive means delete directory
    // force means delete the file inside
    await rm(distDirPath, { recursive: true, force: true });
    console.log(`deleted: ${dirPath}`);
  } catch (error) {
    console.warn(error);
  }
};

export const createDir = async (path) => {
  try {
    await mkdir(path, { recursive: true });
  } catch (error) {
    console.warn(error);
  }
};
