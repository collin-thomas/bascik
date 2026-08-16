import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mock factories ───────────────────────────────────────────────────

const {
  mockSpawn,
  setNextExitCode,
  mockWatch,
  getWatcher,
  mockEventEmit,
  resetMocks,
} = vi.hoisted(() => {
  let nextExitCode = 0;

  const makeProcess = () => {
    const cbs: Record<string, ((...args: unknown[]) => void)[]> = {};
    const proc = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        (cbs[event] ??= []).push(cb);
        if (event === "close") {
          Promise.resolve().then(() => cb(nextExitCode));
        }
        return proc;
      }),
    };
    return proc;
  };

  const mockSpawn = vi.fn(makeProcess);

  const watchers: { on: ReturnType<typeof vi.fn>; _handlers: Record<string, (...args: unknown[]) => void> }[] = [];

  const makeWatcher = () => {
    const _handlers: Record<string, (...args: unknown[]) => void> = {};
    const w = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        _handlers[event] = cb;
        return w;
      }),
      _handlers,
    };
    watchers.push(w);
    return w;
  };

  const mockWatch = vi.fn(makeWatcher);
  const mockEventEmit = vi.fn();

  const resetMocks = () => {
    nextExitCode = 0;
    mockSpawn.mockReset().mockImplementation(makeProcess);
    mockWatch.mockReset().mockImplementation(makeWatcher);
    mockEventEmit.mockReset();
    watchers.length = 0;
  };

  return {
    mockSpawn,
    setNextExitCode: (code: number) => { nextExitCode = code; },
    mockWatch,
    getWatcher: (i: number) => watchers[i],
    mockEventEmit,
    resetMocks,
  };
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("node:child_process", () => ({ spawn: mockSpawn }));
vi.mock("chokidar", () => ({ default: { watch: mockWatch } }));
vi.mock("./events.js", () => ({ eventEmitter: { emit: mockEventEmit } }));

vi.mock("./config.js", () => ({
  BascikConfig: { exec: undefined },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { BascikConfig } from "./config.js";
import { runExecOnBuild, startExecDev } from "./exec.js";

const cfg = BascikConfig as { exec: typeof BascikConfig.exec };

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetMocks();
  cfg.exec = undefined;
});

describe("runExecOnBuild", () => {
  it("does nothing when exec is undefined", async () => {
    await runExecOnBuild();
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("does nothing when exec is empty", async () => {
    cfg.exec = [];
    await runExecOnBuild();
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it("spawns each script with the current node binary", async () => {
    cfg.exec = [{ script: "scripts/a.ts" }, { script: "scripts/b.ts" }];
    await runExecOnBuild();
    expect(mockSpawn).toHaveBeenCalledTimes(2);
    expect(mockSpawn).toHaveBeenNthCalledWith(1, process.execPath, ["scripts/a.ts"], expect.objectContaining({ stdio: "inherit" }));
    expect(mockSpawn).toHaveBeenNthCalledWith(2, process.execPath, ["scripts/b.ts"], expect.objectContaining({ stdio: "inherit" }));
  });

  it("runs scripts sequentially — second does not start until first resolves", async () => {
    const order: string[] = [];
    const scripts = ["a.ts", "b.ts"];
    let call = 0;

    mockSpawn.mockImplementation(() => {
      const script = scripts[call++];
      order.push(`spawn:${script}`);
      const cbs: Record<string, ((...a: unknown[]) => void)[]> = {};
      const proc = {
        on: vi.fn((event: string, cb: (...a: unknown[]) => void) => {
          (cbs[event] ??= []).push(cb);
          if (event === "close") Promise.resolve().then(() => { order.push(`close:${script}`); cb(0); });
          return proc;
        }),
      };
      return proc;
    });

    cfg.exec = [{ script: "a.ts" }, { script: "b.ts" }];
    await runExecOnBuild();
    expect(order).toEqual(["spawn:a.ts", "close:a.ts", "spawn:b.ts", "close:b.ts"]);
  });

  it("rejects when a script exits with a non-zero code", async () => {
    setNextExitCode(1);
    cfg.exec = [{ script: "fail.ts" }];
    await expect(runExecOnBuild()).rejects.toThrow('exec "fail.ts" exited with code 1');
  });

  it("runs both watch-enabled and build-only entries", async () => {
    cfg.exec = [
      { script: "scripts/a.ts", watch: ["content/"] },
      { script: "scripts/b.ts" },
    ];
    await runExecOnBuild();
    expect(mockSpawn).toHaveBeenCalledTimes(2);
  });
});

describe("startExecDev", () => {
  it("does nothing when exec is undefined", () => {
    startExecDev();
    expect(mockSpawn).not.toHaveBeenCalled();
    expect(mockWatch).not.toHaveBeenCalled();
  });

  it("skips entries without watch", () => {
    cfg.exec = [{ script: "scripts/build-only.ts" }];
    startExecDev();
    expect(mockSpawn).not.toHaveBeenCalled();
    expect(mockWatch).not.toHaveBeenCalled();
  });

  it("fires watched entries async on startup", async () => {
    cfg.exec = [{ script: "scripts/gen.ts", watch: ["content/"] }];
    startExecDev();
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockSpawn).toHaveBeenCalledWith(process.execPath, ["scripts/gen.ts"], expect.anything());
  });

  it("does not emit asset-changed on startup run", async () => {
    cfg.exec = [{ script: "scripts/gen.ts", watch: ["content/"] }];
    startExecDev();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(mockEventEmit).not.toHaveBeenCalled();
  });

  it("sets up a chokidar watcher for each watched entry", () => {
    cfg.exec = [
      { script: "scripts/a.ts", watch: ["content/"] },
      { script: "scripts/b.ts", watch: "data/" },
    ];
    startExecDev();
    expect(mockWatch).toHaveBeenCalledTimes(2);
    expect(mockWatch).toHaveBeenNthCalledWith(1, ["content/"], expect.objectContaining({ ignoreInitial: true }));
    expect(mockWatch).toHaveBeenNthCalledWith(2, ["data/"], expect.objectContaining({ ignoreInitial: true }));
  });

  it("normalizes a string watch value to an array", () => {
    cfg.exec = [{ script: "scripts/gen.ts", watch: "content/" }];
    startExecDev();
    expect(mockWatch).toHaveBeenCalledWith(["content/"], expect.anything());
  });

  it("re-runs the script and emits asset-changed on file change", async () => {
    cfg.exec = [{ script: "scripts/gen.ts", watch: ["content/"] }];
    startExecDev();

    // Drain startup: close fires, catch pass-through, finally clears running
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const watcher = getWatcher(0);
    watcher._handlers["all"]();
    await Promise.resolve(); // close fires → .then(emit) queued
    await Promise.resolve(); // emit fires

    expect(mockSpawn).toHaveBeenCalledTimes(2);
    expect(mockEventEmit).toHaveBeenCalledWith("asset-changed");
  });

  it("drops concurrent watch trigger while script is running", async () => {
    cfg.exec = [{ script: "scripts/gen.ts", watch: ["content/"] }];
    startExecDev();

    // Drain startup so running = false
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve(); // 3 ticks: close → catch pass-through → finally

    const watcher = getWatcher(0);
    // Fire twice before first run completes
    watcher._handlers["all"]();
    watcher._handlers["all"](); // should be dropped
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // startup + one watcher run (second dropped)
    expect(mockSpawn).toHaveBeenCalledTimes(2);
  });

  it("logs an error but does not emit asset-changed when the re-run script fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { });
    setNextExitCode(1);
    cfg.exec = [{ script: "scripts/gen.ts", watch: ["content/"] }];
    startExecDev();

    // Drain startup (exits with code 1, .catch logs, .finally clears flag)
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve(); // 3 ticks to clear running

    const watcher = getWatcher(0);
    watcher._handlers["all"]();
    await Promise.resolve();
    await Promise.resolve(); // extra tick for rejection handler

    expect(mockEventEmit).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
