import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "node:os";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("node:fs/promises", () => ({
  access: vi.fn(),
  rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("node:os", () => ({
  default: { platform: vi.fn().mockReturnValue("linux") },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { createSelfSignedCert } from "./pki.js";
import { access, rm } from "node:fs/promises";
import { exec } from "node:child_process";

const mockAccess = access as unknown as ReturnType<typeof vi.fn>;
const mockExec = exec as unknown as ReturnType<typeof vi.fn>;
const mockRm = rm as unknown as ReturnType<typeof vi.fn>;
const mockPlatform = (os as any).platform as ReturnType<typeof vi.fn>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Make exec call its callback with success */
const makeExecSucceed = () => {
  mockExec.mockImplementation(
    (_cmd: string, cb: (err: null, stdout: string, stderr: string) => void) => {
      cb(null, "", "");
    },
  );
};

/** Make exec call its callback with an error */
const makeExecFail = (msg = "openssl not found") => {
  mockExec.mockImplementation((_cmd: string, cb: (err: Error) => void) => {
    cb(new Error(msg));
  });
};

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRm.mockResolvedValue(undefined);
  mockPlatform.mockReturnValue("linux");
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
    // Simulate missing certs (access throws)
    mockAccess.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );
    mockPlatform.mockReturnValue("linux");
  });

  it("calls exec with an openssl req command", async () => {
    makeExecSucceed();
    vi.spyOn(console, "log").mockImplementation(() => {});
    await createSelfSignedCert();
    expect(mockExec).toHaveBeenCalledTimes(1);
    const cmd = mockExec.mock.calls[0][0] as string;
    expect(cmd).toContain("openssl req");
  });

  it("includes localhost in the openssl subject", async () => {
    makeExecSucceed();
    vi.spyOn(console, "log").mockImplementation(() => {});
    await createSelfSignedCert();
    const cmd = mockExec.mock.calls[0][0] as string;
    expect(cmd).toContain("localhost");
  });

  it("logs success after generating the cert", async () => {
    makeExecSucceed();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
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
    mockAccess.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );
    mockPlatform.mockReturnValue("win32");
  });

  it("calls exec multiple times for the Windows PowerShell + openssl flow", async () => {
    makeExecSucceed();
    vi.spyOn(console, "log").mockImplementation(() => {});
    await createSelfSignedCert();
    // Windows path calls exec 3 times (PS, pkcs12 key, pkcs12 cert)
    expect(mockExec).toHaveBeenCalledTimes(3);
  });

  it("the first exec call uses PowerShell", async () => {
    makeExecSucceed();
    vi.spyOn(console, "log").mockImplementation(() => {});
    await createSelfSignedCert();
    const cmd = mockExec.mock.calls[0][0] as string;
    expect(cmd).toContain("powershell");
  });

  it("removes the temporary pfx file after generation", async () => {
    makeExecSucceed();
    vi.spyOn(console, "log").mockImplementation(() => {});
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
  it("logs an error and calls process.exit(1) when exec fails", async () => {
    mockAccess.mockRejectedValue(new Error("ENOENT"));
    makeExecFail("openssl error");
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);
    await createSelfSignedCert();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to generate"),
      expect.any(Error),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
