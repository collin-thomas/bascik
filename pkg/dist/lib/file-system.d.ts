/** Resolve an absolute path to a `parentDir/...` relative path, normalising separators. */
export declare const getRelativePath: (path: string, parentDir: string) => string;
/**
 * Copies a file from src to destRoot, replicating its relative path from 'pages/'.
 * Only copies if the contents differ.
 */
export declare function copyReplicatePath(src: string, destRoot: string): Promise<void>;
export declare const listPages: () => Promise<string[]>;
export declare const deepReadDir: (dirPath: string) => Promise<any[]>;
/**
 *
 * @param {String} dirPath
 * @param {RegExp} filter
 * @returns
 */
export declare const deepReadDirFlat: (dirPath: string, filter?: RegExp) => Promise<string[]>;
export declare const getDirectoryPath: (pagePath: string) => string;
export declare const getDistPagePath: (pagePath: string) => string;
export declare const deleteDistFile: (pagePath: string) => Promise<void>;
export declare const deleteDistDir: (dirPath: string) => Promise<void>;
export declare const createDir: (path: string) => Promise<void>;
