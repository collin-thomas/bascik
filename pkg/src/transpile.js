#!/usr/bin/env node
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const { BascikConfig } =  require("./lib/config.js");
const { watchFiles } = require("./lib/watch.js");

watchFiles();

if (!BascikConfig.isBuild) {
  const { serveHttp2 } = require("./lib/http2.js");
  serveHttp2();
}
