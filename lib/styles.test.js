import { describe, expect, it, vi } from "vitest";
import { getClassNameHash } from "./styles.js";

vi.mock("node:crypto", () => {
  return {
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => "12345678"),
    })),
  };
});

describe("getClassNameHash", () => {
  it("test", () => {
    expect(getClassNameHash("my-class")).toBe("b12345678");
  });
});
