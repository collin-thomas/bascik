import { pathToFileURL } from "node:url";

/**
 * Clean and remap stack traces from ephemeral script files back to the original
 * source template file and line offset.
 */
export const cleanStackTrace = (
  rawTrace: string,
  tmpPath: string,
  realPath: string,
  lineOffset: number,
): string => {
  if (!rawTrace) return rawTrace;

  // Escaping backslashes for Windows paths
  const escapedTmpPath = tmpPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Also support file:// URI schemes in stack traces
  let fileUri = tmpPath;
  try {
    fileUri = pathToFileURL(tmpPath).href;
  } catch { }
  const escapedFileUri = fileUri.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const regex = new RegExp(`(?:${escapedFileUri}|${escapedTmpPath}):(\\d+)`, "g");

  return rawTrace.replace(regex, (match, lineStr) => {
    const lineNum = parseInt(lineStr, 10);
    const mappedLine = lineOffset + lineNum - 1;
    return `${realPath}:${mappedLine}`;
  });
};
