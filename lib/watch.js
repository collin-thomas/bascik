import chokidar from "chokidar";
import { pageProcessing, processAllPages, removePage } from "./processing.js";
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
    .on("add", async () => processAllPages())
    .on("change", async () => processAllPages())
    .on("unlink", async () => processAllPages());
};