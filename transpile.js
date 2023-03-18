import chokidar from "chokidar";
import {
  pageProcessing,
  deleteDistFile,
  deleteDistDir,
  processAllPages,
} from "./lib/functions.js";
import { serveHttp2 } from "./lib/http2.js";

const caught = (fn) => {
  try {
    fn();
  } catch (error) {
    console.warn(error);
  }
};

const watchFiles = () => {
  // Page Files
  chokidar
    .watch(["./pages/**/*.html"])
    .on("add", (path) => pageProcessing(path))
    .on("change", (path) => pageProcessing(path))
    .on("unlink", (path) => deleteDistFile(path));

  // Page Dirs
  chokidar.watch(["./pages/**"]).on("unlinkDir", (path) => deleteDistDir(path));

  // Component Files.
  // You don't need to watch for Components Dirs because we are not writing components

  // I think with effort and then do a performance comparison,
  // updating files based on component trees is possible and maybe more efficent.
  // But for now, rerender all the pages,
  // because we won't know what pages need updated until we recursively loop through all pages.
  // The difference is here, now we need a list of all the pages.

  // ignoreInitial so we don't run "add" on boot
  // and process all the pages times the number of compeonts
  chokidar
    .watch(["./components/**/*.html"], { ignoreInitial: true })
    .on("add", async () => processAllPages())
    .on("change", async () => processAllPages())
    .on("unlink", async () => processAllPages());
};

watchFiles();

if (process.env.BASCIK_SERVE === "1") {
  serveHttp2();
}
