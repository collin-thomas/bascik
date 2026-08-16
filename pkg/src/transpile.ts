import { createSelfSignedCert } from "./lib/pki.js";
import { BascikConfig } from "./lib/config.js";
import { watchFiles } from "./lib/watch.js";
import { runExecOnBuild, startExecDev } from "./lib/exec.js";
import { mem } from "./lib/mem.js";
import { eventEmitter } from "./lib/events.js";

if (BascikConfig.isBuild) {
  await runExecOnBuild();
  await watchFiles();
} else {
  startExecDev();
  // Start server setup in parallel with transpilation — server binds its port
  // while pages are being processed. The URL is printed immediately after the
  // transpilation summary so both lines appear back-to-back.
  const serverReady = Promise.all([
    createSelfSignedCert(),
    import("./lib/http2.js"),
  ]).then(([, { startHttp2Server }]) => startHttp2Server());

  await watchFiles();
  mem.setBootingDone();
  eventEmitter.emit("boot-done");
  console.log(`Server running at ${await serverReady}`);
}
