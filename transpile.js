import chokidar from "chokidar";
import {
  pageProcessing,
  deleteDistFile,
  deleteDistDir,
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

  // Component Files
  chokidar
    .watch(["./components/**/*.html"])
    .on("add", (path) => pageProcessing(path))
    .on("change", (path) => pageProcessing(path))
    .on("unlink", (path) => deleteDistFile(path));

  // Component Dirs
  chokidar
    .watch(["./components/**"])
    .on("addDir", (path) => console.log(`addDir: ${path}`))
    .on("unlinkDir", (path) => console.log(`unlinkDir: ${path}`));
};

watchFiles();

if (process.env.BASCIK_SERVE === "1") {
  serveHttp2();
}
