import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Hoisted mock factories ───────────────────────────────────────────────────

const { mockWatch, getWatcher, clearWatchers } = vi.hoisted(() => {
  const watchers: { on: ReturnType<typeof vi.fn> }[] = [];
  const makeWatcher = () => {
    const w = {
      on: vi.fn(function (
        this: { on: ReturnType<typeof vi.fn> },
        event: string,
        handler: (...args: any[]) => any,
      ) {
        if (event === "ready") {
          void handler();
        }
        return this;
      }),
    };
    watchers.push(w);
    return w;
  };
  return {
    mockWatch: vi.fn((_path: string) => makeWatcher()),
    getWatcher: (i: number) => watchers[i],
    clearWatchers: () => {
      watchers.length = 0;
    },
  };
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("chokidar", () => ({
  default: { watch: mockWatch },
}));

vi.mock("./processing.js", () => ({
  pageProcessing: vi.fn(),
  processAllPages: vi.fn(),
  removePage: vi.fn(),
  selectivelyProcessPages: vi.fn(),
}));

vi.mock("./file-system.js", () => ({
  copyReplicatePath: vi.fn().mockResolvedValue(undefined),
  deleteDistDir: vi.fn().mockResolvedValue(undefined),
  deleteDistFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./config.js", () => ({
  BascikConfig: {
    directory: {
      pages: "/project/src/pages",
      components: "/project/src/components",
      watch: [],
    },
    isBuild: false,
  },
}));

vi.mock("./mime.js", () => ({
  MIME_MAP: new Map([
    [".css", "text/css"],
    [".js", "application/javascript"],
  ]),
}));

vi.mock("./events.js", () => ({
  eventEmitter: { emit: vi.fn() },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { watchFiles } from "./watch.js";
import {
  pageProcessing,
  processAllPages,
  removePage,
  selectivelyProcessPages,
} from "./processing.js";
import {
  copyReplicatePath,
  deleteDistDir,
  deleteDistFile,
} from "./file-system.js";
import { eventEmitter } from "./events.js";

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  clearWatchers();
});

// ─── Helper: get a named event handler from a given watcher index ─────────────

const getHandler = (
  watcherIndex: number,
  event: string,
): ((...args: any[]) => any) | undefined => {
  const watcher = getWatcher(watcherIndex);
  const call = watcher?.on.mock.calls.find((c: any[]) => c[0] === event);
  return call?.[1];
};

// ─────────────────────────────────────────────────────────────────────────────
// Watcher setup
// ─────────────────────────────────────────────────────────────────────────────

describe("watchFiles – watcher setup", () => {
  it("calls chokidar.watch three times", async () => {
    await watchFiles();
    expect(mockWatch).toHaveBeenCalledTimes(3);
  });

  it("watches the pages directory for asset copying", async () => {
    await watchFiles();
    expect(mockWatch.mock.calls[0][0]).toContain("/project/src/pages");
  });

  it("watches the pages directory for html transpilation", async () => {
    await watchFiles();
    expect(mockWatch.mock.calls[1][0]).toContain("/project/src/pages");
  });

  it("watches the components directory", async () => {
    await watchFiles();
    expect(mockWatch.mock.calls[2][0]).toContain("/project/src/components");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Asset watcher (watcher 0) event handlers
// ─────────────────────────────────────────────────────────────────────────────

describe("watchFiles – asset watcher (watcher 0)", () => {
  beforeEach(async () => {
    await watchFiles();
  });

  it("calls copyReplicatePath on 'add'", async () => {
    const handler = getHandler(0, "add");
    await handler?.("/path/to/style.css");
    expect(copyReplicatePath).toHaveBeenCalledWith(
      "/path/to/style.css",
      "dist",
    );
  });

  it("calls copyReplicatePath on 'change'", async () => {
    const handler = getHandler(0, "change");
    await handler?.("/path/to/style.css");
    expect(copyReplicatePath).toHaveBeenCalledWith(
      "/path/to/style.css",
      "dist",
    );
  });

  it("calls deleteDistFile on 'unlink'", async () => {
    const handler = getHandler(0, "unlink");
    handler?.("/path/to/old.css");
    expect(deleteDistFile).toHaveBeenCalledWith("/path/to/old.css");
  });

  it("calls deleteDistDir on 'unlinkDir'", async () => {
    const handler = getHandler(0, "unlinkDir");
    handler?.("/path/to/dir");
    expect(deleteDistDir).toHaveBeenCalledWith("/path/to/dir");
  });

  it("emits asset-changed when a file changes and not in build mode", async () => {
    const handler = getHandler(0, "change");
    await handler?.("/path/to/style.css");
    expect(eventEmitter.emit).toHaveBeenCalledWith("asset-changed");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HTML page watcher (watcher 1) event handlers
// ─────────────────────────────────────────────────────────────────────────────

describe("watchFiles – html page watcher (watcher 1)", () => {
  beforeEach(async () => {
    await watchFiles();
  });

  it("calls processAllPages on 'ready'", async () => {
    const readyHandler = getHandler(1, "ready");
    vi.clearAllMocks();
    await readyHandler?.();
    expect(processAllPages).toHaveBeenCalledTimes(1);
  });

  it("calls pageProcessing on 'add' after ready", () => {
    // ready already fired during watchFiles() in beforeEach; initialScanDone is true
    const addHandler = getHandler(1, "add");
    addHandler?.("/path/to/new-page.html");
    expect(pageProcessing).toHaveBeenCalledWith("/path/to/new-page.html");
  });

  it("calls pageProcessing on 'change'", () => {
    const handler = getHandler(1, "change");
    handler?.("/path/to/page.html");
    expect(pageProcessing).toHaveBeenCalledWith("/path/to/page.html");
  });

  it("calls removePage on 'unlink'", () => {
    const handler = getHandler(1, "unlink");
    handler?.("/path/to/deleted.html");
    expect(removePage).toHaveBeenCalledWith("/path/to/deleted.html");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Component watcher (watcher 2) event handlers
// ─────────────────────────────────────────────────────────────────────────────

describe("watchFiles – component watcher (watcher 2)", () => {
  beforeEach(async () => {
    await watchFiles();
  });

  it("calls processAllPages on 'add'", async () => {
    const handler = getHandler(2, "add");
    await handler?.();
    expect(processAllPages).toHaveBeenCalled();
  });

  it("calls selectivelyProcessPages on 'change'", async () => {
    const handler = getHandler(2, "change");
    await handler?.("/path/to/my-comp.html");
    expect(selectivelyProcessPages).toHaveBeenCalledWith(
      "/path/to/my-comp.html",
    );
  });

  it("calls selectivelyProcessPages on 'unlink'", async () => {
    const handler = getHandler(2, "unlink");
    await handler?.("/path/to/old-comp.html");
    expect(selectivelyProcessPages).toHaveBeenCalledWith(
      "/path/to/old-comp.html",
    );
  });
});
