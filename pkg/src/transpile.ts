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
  const { startServer } = await import("./lib/server.js");
  const serverReady = startServer();

  await watchFiles();
  mem.setBootingDone();
  eventEmitter.emit("boot-done");
  console.log(`Server running at ${await serverReady}`);
}
