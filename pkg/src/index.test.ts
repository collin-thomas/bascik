import { describe, it, expect } from "vitest";
import { resolveCliAction, CLI_USAGE } from "./lib/cli.js";

describe("resolveCliAction", () => {
  it("starts the dev server when called with no args", () => {
    expect(resolveCliAction([])).toEqual({ action: "dev" });
  });

  it("maps --help to help", () => {
    expect(resolveCliAction(["--help"])).toEqual({ action: "help" });
  });

  it("maps -h to help", () => {
    expect(resolveCliAction(["-h"])).toEqual({ action: "help" });
  });

  it("maps --version to version", () => {
    expect(resolveCliAction(["--version"])).toEqual({ action: "version" });
  });

  it("maps -v to version", () => {
    expect(resolveCliAction(["-v"])).toEqual({ action: "version" });
  });

  it("maps init to init", () => {
    expect(resolveCliAction(["init"])).toEqual({ action: "init" });
  });

  it("maps --check to check", () => {
    expect(resolveCliAction(["--check"])).toEqual({ action: "check" });
  });

  it("maps --serve to serve", () => {
    expect(resolveCliAction(["--serve"])).toEqual({ action: "serve" });
  });

  it("maps --build to build", () => {
    expect(resolveCliAction(["--build"])).toEqual({ action: "build" });
  });

  it("returns error with the offending flag for a single unknown flag", () => {
    expect(resolveCliAction(["--frobnicate"])).toEqual({
      action: "error",
      unknownFlags: ["--frobnicate"],
    });
  });

  it("collects multiple unknown flags", () => {
    expect(resolveCliAction(["--nope", "-x"])).toEqual({
      action: "error",
      unknownFlags: ["--nope", "-x"],
    });
  });

  it("treats unknown short flags as errors", () => {
    expect(resolveCliAction(["-z"]).action).toBe("error");
  });

  it("errors on unknown flags even when a known flag is also present", () => {
    expect(resolveCliAction(["--build", "--bogus"])).toEqual({
      action: "error",
      unknownFlags: ["--bogus"],
    });
  });

  it("prefers help over other known flags", () => {
    expect(resolveCliAction(["--build", "--help"])).toEqual({ action: "help" });
  });

  it("prefers version over other known flags", () => {
    expect(resolveCliAction(["--serve", "-v"])).toEqual({ action: "version" });
  });

  it("accepts init alongside a known flag", () => {
    expect(resolveCliAction(["init", "--check"])).toEqual({ action: "init" });
  });

  it("ignores non-flag positional args", () => {
    expect(resolveCliAction(["somepath"])).toEqual({ action: "dev" });
  });
});

describe("CLI_USAGE", () => {
  it("documents all recognized flags and the init subcommand", () => {
    for (const token of [
      "--build",
      "--serve",
      "--check",
      "--help",
      "-h",
      "--version",
      "-v",
      "init",
    ]) {
      expect(CLI_USAGE).toContain(token);
    }
  });
});
