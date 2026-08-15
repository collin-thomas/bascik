import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "node:os";

// vi.hoisted() runs before vi.mock() factories so the same vi.fn() references
// are used in both the factory (which is hoisted) and the test file.
const { _mockAccess, _mockExec, _mockRm } = vi.hoisted(() => ({
  _mockAccess: vi.fn(),
  _mockExec: vi.fn(),
  _mockRm: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("node:fs/promises", () => ({
  access: _mockAccess,
  rm: _mockRm,
}));

vi.mock("node:child_process", () => ({
  exec: _mockExec,
}));

vi.mock("node:os", () => ({
  default: { platform: vi.fn().mockReturnValue("linux") },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { createSelfSignedCert } from "./pki.js";

const mockAccess = _mockAccess;
const mockExec = _mockExec;
const mockRm = _mockRm;
const mockPlatform = (os as any).platform as ReturnType<typeof vi.fn>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeExecSucceed = () => {
  mockExec.mockImplementation(
    (_cmd: string, cb: (err: null, stdout: string, stderr: string) => void) => {
      cb(null, "", "");
    },
  );
};

const makeExecFail = (msg = "openssl not found") => {
  mockExec.mockImplementation((_cmd: string, cb: (err: Error) => void) => {
    cb(new Error(msg));
  });
};

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockAccess.mockReset();
  mockExec.mockReset();
  mockRm.mockReset();
  mockRm.mockResolvedValue(undefined);
  mockPlatform.mockReturnValue("linux");
  mockAccess.mockResolvedValue(undefined); // default: certs exist → early return
});

// ─────────────────────────────────────────────────────────────────────────────
// Certs already exist
// ─────────────────────────────────────────────────────────────────────────────

describe("createSelfSignedCert – certs already exist", () => {
  it("returns early without calling exec when both cert and key exist", async () => {
    mockAccess.mockResolvedValue(undefined); // both access calls succeed
    await createSelfSignedCert();
    expect(mockExec).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cert generation – Unix / macOS / Linux
// ─────────────────────────────────────────────────────────────────────────────

describe("createSelfSignedCert – Unix cert generation", () => {
  beforeEach(() => {
    mockAccess.mockReset();
    mockAccess.mockImplementation(() => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); });
    mockPlatform.mockReturnValue("linux");
  });

  it("calls exec with an openssl req command", async () => {
    makeExecSucceed();
    vi.spyOn(console, "log").mockImplementation(() => { });
    await createSelfSignedCert();
    expect(mockExec).toHaveBeenCalledTimes(1);
    const cmd = mockExec.mock.calls[0][0] as string;
    expect(cmd).toContain("openssl req");
  });

  it("includes localhost in the openssl subject", async () => {
    makeExecSucceed();
    vi.spyOn(console, "log").mockImplementation(() => { });
    await createSelfSignedCert();
    const cmd = mockExec.mock.calls[0][0] as string;
    expect(cmd).toContain("localhost");
  });

  it("logs success after generating the cert", async () => {
    makeExecSucceed();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => { });
    await createSelfSignedCert();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Generated self-signed certificate"),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cert generation – Windows
// ─────────────────────────────────────────────────────────────────────────────

describe("createSelfSignedCert – Windows cert generation", () => {
  beforeEach(() => {
    mockAccess.mockReset();
    mockAccess.mockImplementation(() => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); });
    mockPlatform.mockReturnValue("win32");
  });

  it("calls exec multiple times for the Windows PowerShell + openssl flow", async () => {
    makeExecSucceed();
    vi.spyOn(console, "log").mockImplementation(() => { });
    await createSelfSignedCert();
    expect(mockExec).toHaveBeenCalledTimes(3);
  });

  it("the first exec call uses PowerShell", async () => {
    makeExecSucceed();
    vi.spyOn(console, "log").mockImplementation(() => { });
    await createSelfSignedCert();
    const cmd = mockExec.mock.calls[0][0] as string;
    expect(cmd).toContain("powershell");
  });

  it("removes the temporary pfx file after generation", async () => {
    makeExecSucceed();
    vi.spyOn(console, "log").mockImplementation(() => { });
    await createSelfSignedCert();
    expect(mockRm).toHaveBeenCalledWith(
      expect.stringContaining("bascik-cert.pfx"),
      { force: true },
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Failure handling
// ─────────────────────────────────────────────────────────────────────────────

describe("createSelfSignedCert – exec failure", () => {
  beforeEach(() => {
    mockAccess.mockReset();
    mockAccess.mockImplementation(() => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); });
  });

  it("throws (rather than process.exit) when exec fails", async () => {
    makeExecFail("openssl error");
    await expect(createSelfSignedCert()).rejects.toThrow(
      /Failed to generate self-signed certificate/,
    );
  });

  it("stringifies a non-Error value thrown by exec", async () => {
    mockExec.mockImplementation(
      (_cmd: string, cb: (err: unknown) => void) => { cb("exec string error"); },
    );
    await expect(createSelfSignedCert()).rejects.toThrow("exec string error");
  });
});
