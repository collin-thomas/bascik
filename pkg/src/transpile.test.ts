import { describe, it, expect, vi, beforeEach } from "vitest";

const { _mockWatchFiles, _mockRunExecOnBuild, _mockStartExecDev, _mockStartServer } = vi.hoisted(() => ({
  _mockWatchFiles: vi.fn().mockResolvedValue(undefined),
  _mockRunExecOnBuild: vi.fn().mockResolvedValue(undefined),
  _mockStartExecDev: vi.fn(),
  _mockStartServer: vi.fn().mockResolvedValue("http://localhost:8080"),
}));

vi.mock("./lib/watch.js", () => ({
  watchFiles: _mockWatchFiles,
}));

vi.mock("./lib/exec.js", () => ({
  runExecOnBuild: _mockRunExecOnBuild,
  startExecDev: _mockStartExecDev,
}));

vi.mock("./lib/server.js", () => ({
  startServer: _mockStartServer,
}));

vi.mock("./lib/mem.js", () => ({
  mem: { setBootingDone: vi.fn() },
}));

vi.mock("./lib/events.js", () => ({
  eventEmitter: { emit: vi.fn() },
}));

vi.mock("./lib/config.js", () => ({
  BascikConfig: { isBuild: false },
}));

import { runTranspile } from "./transpile.js";
import { BascikConfig } from "./lib/config.js";

describe("runTranspile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs build pipeline when BascikConfig.isBuild is true", async () => {
    (BascikConfig as any).isBuild = true;
    await runTranspile();

    expect(_mockRunExecOnBuild).toHaveBeenCalled();
    expect(_mockWatchFiles).toHaveBeenCalled();
    expect(_mockStartExecDev).not.toHaveBeenCalled();
  });

  it("runs dev pipeline when BascikConfig.isBuild is false", async () => {
    (BascikConfig as any).isBuild = false;
    await runTranspile();

    expect(_mockStartExecDev).toHaveBeenCalled();
    expect(_mockStartServer).toHaveBeenCalled();
    expect(_mockWatchFiles).toHaveBeenCalled();
  });

  it("handles server startup error gracefully when exitOnError is false", async () => {
    (BascikConfig as any).isBuild = false;
    _mockStartServer.mockRejectedValueOnce(new Error("Port in use"));

    await expect(runTranspile({ exitOnError: false })).rejects.toThrow("Port in use");
  });
});
