import chokidar from "chokidar";
import { pageProcessing, processAllPages } from "./lib/processing.js";
import { deleteDistFile, deleteDistDir, createDir } from "./lib/file-system.js";

import { serveHttp2 } from "./lib/http2.js";

const serve = parseInt(process.env.BASCIK_SERVE) === 1;

const watchFiles = () => {
  // Page Files
  chokidar
    .watch(["./pages/**/*.html"], { persistent: serve })
    .on("add", (path) => pageProcessing(path))
    .on("change", (path) => pageProcessing(path))
    .on("unlink", (path) => deleteDistFile(path));

  // Page Dirs
  chokidar
    .watch(["./pages/**"], { persistent: serve })
    .on("unlinkDir", (path) => deleteDistDir(path));
  // Kinda unnecessary but in case pages gets deleted it is handled gracefully.
  // Known bug, if you rename a folder full of files to "./pages",
  // it will not trigger pageProcessing. Same for "./compenets".
  chokidar
    .watch(["./pages"], { persistent: serve })
    .on("unlinkDir", async (path) => {
      await deleteDistDir(path);
      // Recreate dist dir after it gets deleted
      await createDir("./dist");
    });

  // Component Files (HTML & CSS)
  // You don't need to watch for Components Dirs because we are not writing components

  // I think with effort and then do a performance comparison,
  // updating files based on component trees is possible and maybe more efficent.
  // But for now, rerender all the pages,
  // because we won't know what pages need updated until we recursively loop through all pages.
  // The difference is here, now we need a list of all the pages.

  // ignoreInitial so we don't run "add" on boot
  // and process all the pages times the number of compeonts
  chokidar
    .watch(["./components/**/*.html", "./components/**/*.css"], {
      ignoreInitial: true,
      persistent: serve,
    })
    .on("add", async () => processAllPages())
    .on("change", async () => processAllPages())
    .on("unlink", async () => processAllPages());
};

watchFiles();

if (serve) {
  serveHttp2();
}
