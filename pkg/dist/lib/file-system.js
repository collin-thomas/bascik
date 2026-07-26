import { readdir, rm, mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { BascikConfig } from "./config.js";
import { minifyCss } from "./styles.js";
/** Resolve an absolute path to a `parentDir/...` relative path, normalising separators. */
export const getRelativePath = (path, parentDir) => {
    // Add pages to the path so we don't break all the existing code
    // that expects pages to be in a directory called pages
    const suffix = path.split(BascikConfig.directory[parentDir])[1];
    // Normalise backslashes to forward slashes (Windows support)
    return `${parentDir}${suffix.replace(/\\/g, "/")}`;
};
/** Stream-hash a file using MD5. Only used for change detection — not security. */
async function calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = createHash("md5");
        const stream = createReadStream(filePath);
        stream.on("data", (chunk) => {
            hash.update(chunk);
        });
        stream.on("end", () => {
            resolve(hash.digest("hex"));
        });
        stream.on("error", (err) => {
            reject(err);
        });
    });
}
/**
 * Copies a file from src to destRoot, replicating its relative path from 'pages/'.
 * Only copies if the contents differ.
 */
export async function copyReplicatePath(src, destRoot) {
    const relativePath = getRelativePath(src, "pages");
    const relativePathWithoutPagesDir = relativePath.replace(/^pages[\\/]/, "");
    const destPath = resolve(destRoot, relativePathWithoutPagesDir);
    const destDir = dirname(destPath);
    // Make dir path for file
    await mkdir(destDir, { recursive: true });
    // Only copy if file hashes differ
    try {
        if (BascikConfig.minifyStyles && src.endsWith(".css")) {
            // Read, minify, and write CSS rather than doing a raw copy
            const minified = minifyCss((await readFile(src)).toString());
            const destHash = createHash("md5").update(await readFile(destPath).catch(() => "")).digest("hex");
            const minifiedHash = createHash("md5").update(minified).digest("hex");
            if (minifiedHash === destHash)
                return;
            await writeFile(destPath, minified);
            console.log("copied (minified):", src);
        }
        else {
            const [srcHash, destHash] = await Promise.all([
                calculateFileHash(src),
                // The dest file might not exist, so return null
                calculateFileHash(destPath).catch(() => null),
            ]);
            if (srcHash === destHash)
                return;
            await copyFile(src, destPath);
            console.log("copied:", src);
        }
    }
    catch (err) {
        console.error("Failed to copy file:", src, err);
    }
}
export const listPages = async () => {
    return deepReadDirFlat(BascikConfig.directory.pages, /\.html$/);
};
// Taken from https://stackoverflow.com/a/71166133/1469690
// Returns any[] because the recursive structure cannot be expressed as a fixed-depth generic.
export const deepReadDir = async (dirPath) => {
    try {
        // withFileTypes is what makes it return dirent
        const dirents = await readdir(dirPath, { withFileTypes: true });
        return Promise.all(dirents.map(async (dirent) => {
            const path = join(dirPath, dirent.name);
            return dirent.isDirectory() ? await deepReadDir(path) : path;
        }));
    }
    catch (error) {
        console.error(`Failed to read directory ${dirPath}`, ...(BascikConfig.verboseLogging ? [{ cause: error }] : []));
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
        if (!filter)
            return files;
        return files.filter((filePath) => `${filePath}`.match(filter));
    }
    catch (error) {
        console.error("Error Reading Directory", error);
        return [];
    }
};
export const getDirectoryPath = (pagePath) => {
    return pagePath.split(/[\/]/).slice(1, -1).join("/");
};
export const getDistPagePath = (pagePath) => {
    const pathParts = pagePath.split(/[\/]/);
    pathParts[0] = "dist";
    return pathParts.join("/");
};
export const deleteDistFile = async (pagePath) => {
    try {
        const distPagePath = getDistPagePath(pagePath);
        await rm(distPagePath);
        console.log(`deleted file: ${pagePath}`);
    }
    catch (error) {
        // File doesn't exist, that's ok.
        // Don't check prior, per node.js doc's say not to because race conditions
        if (error.code === "ENOENT")
            return;
        console.error("Error Deleting Dist File", error);
    }
};
export const deleteDistDir = async (dirPath) => {
    try {
        const distDirPath = dirPath.replace("pages", "dist");
        // recursive means delete directory
        // force means delete the file inside
        await rm(distDirPath, { recursive: true, force: true });
        console.log(`deleted dir: ${dirPath}`);
    }
    catch (error) {
        // File doesn't exist, that's ok.
        // Don't check prior, per node.js doc's say not to because race conditions
        if (error.code === "ENOENT")
            return;
        console.error("Error Deleting Dist Directory", error);
    }
};
export const createDir = async (path) => {
    try {
        await mkdir(path, { recursive: true });
    }
    catch (error) {
        console.error("Error Creating Dist Directory", error);
    }
};
//# sourceMappingURL=file-system.js.map