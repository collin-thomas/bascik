import chokidar from "chokidar";
import { pageProcessing, processAllPages } from "./lib/processing.js";
import { deleteDistFile, deleteDistDir } from "./lib/file-system.js";
import { serveHttp2 } from "./lib/http2.js";

const serveEnabled = parseInt(process.env.BASCIK_SERVE) === 1;

const watchFiles = () => {
  // Page Files
  chokidar
    .watch(["pages"], { 
      // only watch html files
      ignored: (path, stats) => stats?.isFile() && !path.endsWith('.html'), 
      persistent: true 
    })
    .on("add", (path) => pageProcessing(path))
    .on("change", (path) => pageProcessing(path))
    .on("unlink", (path) => deleteDistFile(path))
    .on("unlinkDir", (path) => deleteDistDir(path))

  chokidar
    .watch(["./components"], {
      ignored: (path, stats) => {
        return stats?.isFile() && !(path.endsWith('.html') || path.endsWith('.css'))
      }, 
      ignoreInitial: true,
      persistent: true 
    })
    .on("add", async () => processAllPages())
    .on("change", async () => processAllPages())
    .on("unlink", async () => processAllPages());
};

watchFiles();

if (serveEnabled) {
  serveHttp2();
}
