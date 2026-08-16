import chokidar from "chokidar";
import type { Stats } from "node:fs";
import {
  pageProcessing,
  processAllPages,
  removePage,
  selectivelyProcessPages,
  selectivelyProcessPagesForWatchPath,
} from "./processing.js";
import {
  copyReplicatePath,
  deleteDistDir,
  deleteDistFile,
} from "./file-system.js";
import { BascikConfig } from "./config.js";
import { MIME_MAP } from "./mime.js";
import { eventEmitter } from "./events.js";

export const watchFiles = async () => {
  const onWatchError = (err: unknown) => console.error("[bascik] watch error:", err);

  // Copy non-page files
  chokidar
    .watch([BascikConfig.directory.pages], {
      ignored: (path: string, stats?: Stats): boolean => {
        const hasFileExt = Array.from(MIME_MAP.keys()).some((ext) =>
          ext.startsWith(".") && path.endsWith(ext),
        );
        return !!(stats?.isFile() && !hasFileExt);
      },
      persistent: !BascikConfig.isBuild,
    })
    .on("add", (path) => copyReplicatePath(path, "dist").catch(onWatchError))
    .on("change", async (path) => {
      try {
        await copyReplicatePath(path, "dist");
        // Reload any currently-open page when a static asset changes
        if (!BascikConfig.isBuild) {
          eventEmitter.emit("asset-changed");
        }
      } catch (err) { onWatchError(err); }
    })
    .on("unlink", (path) => deleteDistFile(path).catch(onWatchError))
    .on("unlinkDir", (path) => deleteDistDir(path).catch(onWatchError));

  // Transpile pages as they change
  let initialScanDone = false;
  await new Promise<void>((resolve, reject) => {
    chokidar
      .watch([BascikConfig.directory.pages], {
        // only watch html files
        ignored: (path: string, stats?: Stats): boolean =>
          !!(stats?.isFile() && !path.endsWith(".html")),
        persistent: !BascikConfig.isBuild,
      })
      .on("add", (path) => {
        if (initialScanDone) pageProcessing(path).catch(onWatchError);
      })
      .on("change", (path) => pageProcessing(path).catch(onWatchError))
      .on("unlink", (path: string, _stats?: Stats) => removePage(path).catch(onWatchError))
      .on("unlinkDir", (path: string, _stats?: Stats) => deleteDistDir(path).catch(onWatchError))
      .on("ready", () => {
        initialScanDone = true;
        processAllPages().then(() => resolve()).catch(reject);
      });
  });

  // Transpile pages if components change
  chokidar
    .watch([BascikConfig.directory.components], {
      ignored: (path: string, stats?: Stats): boolean => {
        return !!(
          stats?.isFile() && !(path.endsWith(".html") || path.endsWith(".css"))
        );
      },
      ignoreInitial: true,
      persistent: !BascikConfig.isBuild,
    })
    // If you add a component, how will we know what pages to update unless we go and look
    .on("add", async () => processAllPages().catch(onWatchError))
    // For changes and deletion of components we can be selective
    .on("change", async (path) => selectivelyProcessPages(path).catch(onWatchError))
    .on("unlink", async (path) => selectivelyProcessPages(path).catch(onWatchError));

  // Re-transpile all pages when user-specified extra paths change (dev only)
  if (!BascikConfig.isBuild && BascikConfig.watch.length) {
    chokidar
      .watch(BascikConfig.watch, {
        ignoreInitial: true,
        persistent: true,
      })
      .on("add", async (path) => selectivelyProcessPagesForWatchPath(path).catch(onWatchError))
      .on("change", async (path) => selectivelyProcessPagesForWatchPath(path).catch(onWatchError))
      .on("unlink", async () => processAllPages().catch(onWatchError));
  }
};
