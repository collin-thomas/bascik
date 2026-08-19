import { describe, expect, it, vi } from "vitest";
import { minifyAttributeName, obfuscateAttributeName, getAttributeNameHash, getUniqueId } from './names.js'
import { BascikConfig } from "./config.js";


vi.mock("./config.js", () => {
  return {
    BascikConfig: { minify: { identifiers: false } },
  };
});

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => "012345678901"),
    })),
  };
});


describe("getAttributeNameHash", () => {
  it("returns hash", () => {
    expect(getAttributeNameHash("my-class")).toBe('b012345678901');
  });
});

describe("minifyAttributeName", () => {
  it("returns the name unchanged when minify.identifiers is false", () => {
    expect(minifyAttributeName("my-class")).toBe("my-class");
    expect(obfuscateAttributeName("my-class")).toBe("my-class");
  });

  it("returns the hash when minify.identifiers is true", () => {
    (BascikConfig as { minify: { identifiers: boolean } }).minify.identifiers = true;
    expect(minifyAttributeName("my-class")).toBe("b012345678901");
    expect(obfuscateAttributeName("my-class")).toBe("b012345678901");
    (BascikConfig as { minify: { identifiers: boolean } }).minify.identifiers = false;
  });
});

describe("getUniqueId", () => {
  it("returns a lowercase hex string of the requested length", () => {
    const id = getUniqueId(8);
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it("rounds an odd length up to the nearest even number", () => {
    // length=7 → rounds to 8 → randomBytes(4) → 8 hex chars
    const id = getUniqueId(7);
    expect(id).toMatch(/^[0-9a-f]{8}$/);
  });

  it("returns different values on each call", () => {
    const id1 = getUniqueId(8);
    const id2 = getUniqueId(8);
    expect(id1).not.toBe(id2);
  });
});