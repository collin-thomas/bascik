import { describe, it, expect } from "vitest";
import { cleanStackTrace } from "./stack-trace.js";

describe("cleanStackTrace", () => {
  it("returns raw trace if trace is empty or falsy", () => {
    expect(cleanStackTrace("", "/tmp/file.mjs", "src/pages/index.html", 10)).toBe("");
  });

  it("replaces tmp file path and maps line numbers using lineOffset", () => {
    const tmpPath = "/project/node_modules/.cache/bascik/server-123.mjs";
    const realPath = "src/pages/about.html";
    const lineOffset = 15;
    const rawTrace = `Error: Server error\n    at ${tmpPath}:3:8`;

    const cleaned = cleanStackTrace(rawTrace, tmpPath, realPath, lineOffset);
    expect(cleaned).toBe(`Error: Server error\n    at ${realPath}:17:8`);
  });

  it("handles file:// URI format in stack trace", () => {
    const tmpPath = "/project/node_modules/.cache/bascik/build-456.mjs";
    const realPath = "src/components/card.html";
    const lineOffset = 5;
    const rawTrace = `Error: Build error\n    at file://${tmpPath}:2:4`;

    const cleaned = cleanStackTrace(rawTrace, tmpPath, realPath, lineOffset);
    expect(cleaned).toBe(`Error: Build error\n    at ${realPath}:6:4`);
  });
});
