import { describe, expect, it, vi } from "vitest";
import { obfuscateAttributeName, getAttributeNameHash } from './names.js'


vi.mock("./config.js", () => {
  return {
    BascikConfig: { obfuscateAttributeNames: false },
  };
});

vi.mock("node:crypto", () => {
  return {
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

describe("obfuscateAttributeName", () => {
  it("off", () => {
    expect(obfuscateAttributeName("my-class")).toBe("my-class");
  });
});