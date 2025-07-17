import { readdir, rm, mkdir, copyFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { createHash } from 'node:crypto';
import { createReadStream } from "node:fs";

// Function from LLM
async function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('md5');
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Copies a file from src to destRoot, replicating its relative path from 'pages/'.
 * Only copies if the contents differ.
 */
export async function copyReplicatePath(src, destRoot) {
  const relativePath = src.replace(/^pages[\\/]/, '');
  const destPath = resolve(destRoot, relativePath);
  const destDir = dirname(destPath);

  // Make dir path for file
  await mkdir(destDir, { recursive: true });

  // Only copy if file hashes differ
  try {
    const [srcHash, destHash] = await Promise.all([
      calculateFileHash(src),
      // The dest file might not exist, so return null
      calculateFileHash(destPath).catch(() => null),
    ]);
    if (srcHash === destHash) return
    await copyFile(src, destPath);
    console.log('copied:', src);
  } catch (err) {
    console.error('Failed to copy file:', src, err);
  }
}

export const listPages = async () => {
  return deepReadDirFlat("./pages", /\.html$/);
};

// Taken from https://stackoverflow.com/a/71166133/1469690
export const deepReadDir = async (dirPath) => {
  try {
    // withFileTypes is what makes it return dirent
    const dirents = await readdir(dirPath, { withFileTypes: true });
    return Promise.all(
      dirents.map(async (dirent) => {
        const path = join(dirPath, dirent.name);
        return dirent.isDirectory() ? await deepReadDir(path) : path;
      })
    );
  } catch (error) {
    console.error(`Failed to read directory ${dirPath}`, { cause: error });
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
  try {
    const files = (await deepReadDir(dirPath)).flat(Number.POSITIVE_INFINITY);
    if (!filter) return files;
    return files.filter((filePath) => `${filePath}`.match(filter));
  } catch (error) {
    console.error('Error Reading Directory', error)
  }
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
    console.log(`deleted file: ${pagePath}`);
  } catch (error) {
    // File doesn't exist, that's ok.
    // Don't check prior, per node.js doc's say not to because race conditions
    if (error.code === 'ENOENT') return
    console.error('Error Deleting Dist File', error);
  }
};

export const deleteDistDir = async (dirPath) => {
  try {
    const distDirPath = dirPath.replace("pages", "dist");
    // recursive means delete directory
    // force means delete the file inside
    await rm(distDirPath, { recursive: true, force: true });
    console.log(`deleted dir: ${dirPath}`);
  } catch (error) {
    // File doesn't exist, that's ok.
    // Don't check prior, per node.js doc's say not to because race conditions
    if (error.code === 'ENOENT') return
    console.error('Error Deleting Dist Directory', error);
  }
};

export const createDir = async (path) => {
  try {
    await mkdir(path, { recursive: true });
  } catch (error) {
    console.error('Error Creating Dist Directory', error);
  }
};
