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
  const serverReady = startServer().catch((err) => {
    console.error("Server startup failed:", err);
    process.exit(1);
  });

  await watchFiles();
  mem.setBootingDone();
  eventEmitter.emit("boot-done");
  const url = await serverReady;
  if (url) console.log(`Server running at ${url}`);
}
