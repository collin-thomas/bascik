import { BascikConfig } from "./lib/config.js";
import { watchFiles } from "./lib/watch.js";

watchFiles();

if (!BascikConfig.isBuild) {
  const { serveHttp2 } = await import("./lib/http2.js");
  serveHttp2();
}
