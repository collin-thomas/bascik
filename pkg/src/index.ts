#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CLI_USAGE, resolveCliAction } from "./lib/cli.js";

// Read the installed package version from package.json. The compiled output
// lives in dist/, so package.json is one level up from this file; that also
// holds when running from src/ (type-stripped) where it is two levels up.
const readVersion = async (): Promise<string> => {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [
    join(here, "../package.json"),
    join(here, "../../package.json"),
  ]) {
    try {
      const raw = await readFile(candidate, "utf8");
      const version = (JSON.parse(raw) as { version?: string }).version;
      if (version) return version;
    } catch {
      // Try the next candidate path.
    }
  }
  return "unknown";
};

const resolveBuildLogPath = (args: string[]): string | undefined => {
  const logIndex = args.indexOf("--log");
  if (logIndex === -1) return undefined;
  const nextArg = args[logIndex + 1];
  return nextArg && !nextArg.startsWith("-") ? nextArg : ".bascik/build.log";
};

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const decision = resolveCliAction(args);
  const buildLogPath = resolveBuildLogPath(args);

  if (decision.action === "build" && buildLogPath) {
    const { mkdir, appendFile } = await import("node:fs/promises");
    const { dirname, resolve } = await import("node:path");
    const { format } = await import("node:util");

    const absoluteLogPath = resolve(process.cwd(), buildLogPath);
    await mkdir(dirname(absoluteLogPath), { recursive: true });
    process.env.BASCIK_BUILD_LOG = absoluteLogPath;

    const original = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    const tee = (method: keyof typeof original, target: (...args: unknown[]) => void) => {
      return (...args: unknown[]) => {
        target(...args);
        appendFile(absoluteLogPath, `${format(...args)}\n`, "utf8").catch(() => { });
      };
    };

    console.log = tee("log", original.log) as typeof console.log;
    console.warn = tee("warn", original.warn) as typeof console.warn;
    console.error = tee("error", original.error) as typeof console.error;
    console.log(`[bascik] build log: ${absoluteLogPath}`);
  }

  switch (decision.action) {
    case "help":
      console.log(CLI_USAGE);
      return;
    case "version":
      console.log(await readVersion());
      return;
    case "error": {
      const flags = decision.unknownFlags ?? [];
      console.error(
        `Error: unknown flag${flags.length > 1 ? "s" : ""}: ${flags.join(", ")}\n`,
      );
      console.error(CLI_USAGE);
      process.exit(1);
      return;
    }
    case "init": {
      const { initProject } = await import("./lib/init.js");
      console.log("\nInitializing Bascik project…\n");
      await initProject();
      process.exit(0);
      return;
    }
    case "check": {
      const { checkProject } = await import("./lib/check.js");
      const ok = await checkProject();
      process.exit(ok ? 0 : 1);
      return;
    }
    case "serve": {
      const { serveProduction } = await import("./lib/serve.js");
      await serveProduction();
      return;
    }
    case "dev":
    case "build":
    default:
      // Both the dev server and `bascik --build` run through transpile.js,
      // which branches on BascikConfig.isBuild (set from process.argv/env).
      await import("./transpile.js");
  }
};

await main();
