import chokidar from "chokidar";
import { pageProcessing, processAllPages, removePage, selectivelyProcessPages } from "./processing.js";
import { deleteDistDir } from "./file-system.js";
import { BascikConfig } from "./config.js";

export const watchFiles = () => {
  // Page Files
  chokidar
    .watch(["pages"], {
      // only watch html files
      ignored: (path, stats) => stats?.isFile() && !path.endsWith('.html'),
      persistent: !BascikConfig.isBuild
    })
    .on("add", (path) => pageProcessing(path))
    .on("change", (path) => pageProcessing(path))
    .on("unlink", (path) => removePage(path))
    .on("unlinkDir", (path) => deleteDistDir(path))

  chokidar
    .watch(["./components"], {
      ignored: (path, stats) => {
        return stats?.isFile() && !(path.endsWith('.html') || path.endsWith('.css'))
      },
      ignoreInitial: true,
      persistent: !BascikConfig.isBuild
    })
    // If you add a component, how will we know what pages to update unless we go and look
    .on("add", async () => processAllPages())
    // For changes and deletion of components we can be selective
    .on("change", async (path) => selectivelyProcessPages(path))
    .on("unlink", async (path) => selectivelyProcessPages(path));
};