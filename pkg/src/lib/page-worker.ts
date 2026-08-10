import { parentPort, workerData } from "node:worker_threads";
import { transpilePage } from "./processing.js";
import type { ComponentList, TranspilePageResult } from "./types.js";

const { componentList, globalStylesHtml } = workerData as {
  componentList: ComponentList;
  globalStylesHtml: string;
};

parentPort?.on("message", async (pagePath: string) => {
  try {
    const result = await transpilePage(pagePath, componentList, globalStylesHtml);
    parentPort?.postMessage({ ok: true, result });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    parentPort?.postMessage({ ok: false, error: errorMsg });
  }
});
