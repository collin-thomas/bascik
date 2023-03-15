import chokidar from "chokidar";
import { pageProcessing } from "./lib/functions.js";
import { serveHttp2 } from "./lib/http2.js";

const watchFiles = () => {
  chokidar
    // "all" is add, addDir, change, unlink, unlinkDir. (unlink means delete)
    .watch(["./components/**/*.html", "./pages/**/*.html"])
    .on("all", async (event, path) => {
      console.log(event === "add" ? "watching:" : `${event}:`, path);
      pageProcessing(path);
    });
};

watchFiles();

if (process.env.BASCIK_SERVE === "1") {
  serveHttp2();
}
