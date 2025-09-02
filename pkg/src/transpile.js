#!/usr/bin/env node
import { createRequire } from "module";
import { createSelfSignedCert } from "./lib/pki.js";
import { BascikConfig } from "./lib/config.js";
import { watchFiles } from "./lib/watch.js";

watchFiles();

if (!BascikConfig.isBuild) {
  createSelfSignedCert()
  const require = createRequire(import.meta.url);
  const { serveHttp2 } = require("./lib/http2.js");
  serveHttp2();
}
