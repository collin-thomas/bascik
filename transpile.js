import { watchFiles } from "./lib/watch.js";
import { serveHttp2 } from "./lib/http2.js";

watchFiles();
serveHttp2();
