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
  // Copy non-page files
  chokidar
    .watch([BascikConfig.directory.pages], {
      ignored: (path: string, stats?: Stats): boolean => {
        const hasFileExt = Array.from(MIME_MAP.keys()).some((ext) =>
          new RegExp(`${ext}$`).test(path),
        );
        return !!(stats?.isFile() && !hasFileExt);
      },
      persistent: !BascikConfig.isBuild,
      usePolling: true,
      interval: 1000,
    })
    .on("add", (path) => copyReplicatePath(path, "dist"))
    .on("change", async (path) => {
      await copyReplicatePath(path, "dist");
      // Reload any currently-open page when a static asset changes
      if (!BascikConfig.isBuild) {
        eventEmitter.emit("asset-changed");
      }
    })
    .on("unlink", (path) => deleteDistFile(path))
    .on("unlinkDir", (path) => deleteDistDir(path));

  // Transpile pages as they change
  let initialScanDone = false;
  await new Promise<void>((resolve) => {
    chokidar
      .watch([BascikConfig.directory.pages], {
        // only watch html files
        ignored: (path: string, stats?: Stats): boolean =>
          !!(stats?.isFile() && !path.endsWith(".html")),
        persistent: !BascikConfig.isBuild,
        usePolling: true,
        interval: 1000,
      })
      .on("add", (path) => {
        if (initialScanDone) pageProcessing(path);
      })
      .on("change", (path) => pageProcessing(path))
      .on("unlink", (path: string, _stats?: Stats) => removePage(path))
      .on("unlinkDir", (path: string, _stats?: Stats) => deleteDistDir(path))
      .on("ready", async () => {
        initialScanDone = true;
        await processAllPages();
        resolve();
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
      usePolling: true,
      interval: 1000,
    })
    // If you add a component, how will we know what pages to update unless we go and look
    .on("add", async () => processAllPages())
    // For changes and deletion of components we can be selective
    .on("change", async (path) => selectivelyProcessPages(path))
    .on("unlink", async (path) => selectivelyProcessPages(path));

  // Re-transpile all pages when user-specified extra paths change (dev only)
  if (!BascikConfig.isBuild && BascikConfig.directory.watch.length) {
    chokidar
      .watch(BascikConfig.directory.watch, {
        ignoreInitial: true,
        persistent: true,
        usePolling: true,
        interval: 1000,
      })
      .on("add", async (path) => selectivelyProcessPagesForWatchPath(path))
      .on("change", async (path) => selectivelyProcessPagesForWatchPath(path))
      .on("unlink", async () => processAllPages());
  }
};
