#!/usr/bin/env node
import { createSelfSignedCert } from "./lib/pki.js";
import { BascikConfig } from "./lib/config.js";
import { watchFiles } from "./lib/watch.js";

watchFiles();

if (!BascikConfig.isBuild) {
  await createSelfSignedCert();
  const { serveHttp2 } = await import("./lib/http2.js");
  serveHttp2();
}
