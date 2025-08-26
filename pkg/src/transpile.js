#!/usr/bin/env node
import { createRequire } from "module";
import { createSelfSignedCert } from "./lib/pki.js";
const require = createRequire(import.meta.url);
const { BascikConfig } =  require("./lib/config.js");
const { watchFiles } = require("./lib/watch.js");

watchFiles();

if (!BascikConfig.isBuild) {
  createSelfSignedCert()
  const { serveHttp2 } = require("./lib/http2.js");
  serveHttp2();
}
