#!/usr/bin/env node
import { createSelfSignedCert } from "./lib/pki.js";
import { BascikConfig } from "./lib/config.js";
import { watchFiles } from "./lib/watch.js";

if (process.argv.includes("--check")) {
  const { checkProject } = await import("./lib/check.js");
  const ok = await checkProject();
  process.exit(ok ? 0 : 1);
}

watchFiles();

if (!BascikConfig.isBuild) {
  await createSelfSignedCert();
  const { serveHttp2 } = await import("./lib/http2.js");
  serveHttp2();
}
