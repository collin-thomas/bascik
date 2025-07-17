import chokidar from "chokidar";
import { pageProcessing, processAllPages, removePage, selectivelyProcessPages } from "./processing.js";
import { copyReplicatePath, deleteDistDir, deleteDistFile } from "./file-system.js";
import { BascikConfig } from "./config.js";
import { MIME_MAP } from "./mime.js";

export const watchFiles = () => {
  // Copy non-page files
  chokidar
    .watch(["./pages"], {
      ignored: (path, stats) => {
        const hasFileExt = Array.from(MIME_MAP.keys()).some(ext => (new RegExp(`${ext}$`)).test(path))
        return stats?.isFile() && !hasFileExt
      },
      // watch any file except .html and files without an ext
      //ignored: (path, stats) => stats?.isFile() && path.endsWith('.html') && path.match(/\w+\.\w+$/),
      persistent: !BascikConfig.isBuild
    })
    .on("add", (path) => copyReplicatePath(path, 'dist'))
    .on("change", (path) => copyReplicatePath(path, 'dist'))
    .on("unlink", (path) => deleteDistFile(path))
    .on("unlinkDir", (path) => deleteDistDir(path));

  // Transpile pages as they change
  chokidar
    .watch(["./pages"], {
      // only watch html files
      ignored: (path, stats) => stats?.isFile() && !path.endsWith('.html'),
      persistent: !BascikConfig.isBuild,
    })
    .on("add", (path) => pageProcessing(path))
    .on("change", (path) => pageProcessing(path))
    .on("unlink", (path) => removePage(path))
    .on("unlinkDir", (path) => deleteDistDir(path));

  // Transpile pages if components change
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