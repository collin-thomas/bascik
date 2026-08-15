import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isTypeScriptOpenTag,
  stripTypes,
  transpileInlineTypeScript,
} from "./typescript.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isTypeScriptOpenTag", () => {
  it("detects the data-bascik-ts flag", () => {
    expect(isTypeScriptOpenTag("<script data-bascik-ts>")).toBe(true);
  });

  it("detects valued and casing variants", () => {
    expect(isTypeScriptOpenTag('<script data-bascik-ts="">')).toBe(true);
    expect(isTypeScriptOpenTag("<script data-bascik-ts='true'>")).toBe(true);
    expect(isTypeScriptOpenTag("<script DATA-BASCIK-TS>")).toBe(true);
    expect(isTypeScriptOpenTag('<script defer data-bascik-ts data-x="1">')).toBe(true);
  });

  it("does not match scripts without the flag", () => {
    expect(isTypeScriptOpenTag("<script>")).toBe(false);
    expect(isTypeScriptOpenTag('<script type="module">')).toBe(false);
    expect(isTypeScriptOpenTag("<script data-bascik-build>")).toBe(false);
  });

  it("does not match data-bascik-ts inside another attribute value", () => {
    expect(isTypeScriptOpenTag('<script title="set data-bascik-ts later">')).toBe(false);
  });

  it("does not match longer attribute names sharing the prefix", () => {
    expect(isTypeScriptOpenTag("<script data-bascik-tsx>")).toBe(false);
  });
});

describe("stripTypes", () => {
  it("erases annotations while preserving positions", () => {
    const out = stripTypes("const n: number = 1;");
    expect(out).toContain("const n");
    expect(out).toContain("= 1;");
    expect(out).not.toContain("number");
    expect(out.length).toBe("const n: number = 1;".length);
  });

  it("erases interfaces and as-casts", () => {
    const src = [
      "interface P { x: string }",
      "const el = document.getElementById('x') as HTMLButtonElement;",
    ].join("\n");
    const out = stripTypes(src);
    expect(out).not.toContain("interface");
    expect(out).not.toContain("HTMLButtonElement");
    expect(out).toContain("document.getElementById('x')");
  });
});

describe("transpileInlineTypeScript", () => {
  it("returns html unchanged when no data-bascik-ts script exists", () => {
    const html = "<div><script>const a = 1;</script></div>";
    expect(transpileInlineTypeScript(html)).toBe(html);
  });

  it("strips types from a data-bascik-ts client script and removes the attribute", () => {
    const html = "<script data-bascik-ts>const n: number = 1;\nconsole.log(n);</script>";
    const out = transpileInlineTypeScript(html);
    expect(out).not.toContain("data-bascik-ts");
    expect(out).not.toContain(": number");
    expect(out).toContain("<script>");
    expect(out).toContain("console.log(n);");
  });

  it("keeps other attributes on the open tag", () => {
    const html = '<script defer data-bascik-ts data-x="1">const a: string = "y";</script>';
    const out = transpileInlineTypeScript(html);
    expect(out).toContain('<script defer data-x="1">');
    expect(out).not.toContain(": string");
  });

  it("leaves data-bascik-build data-bascik-ts scripts untouched (handled at execution time)", () => {
    const html = "<script data-bascik-build data-bascik-ts>const n: number = 1;</script>";
    expect(transpileInlineTypeScript(html)).toBe(html);
  });

  it("leaves data-bascik-server data-bascik-ts scripts untouched (handled at execution time)", () => {
    const html = "<script data-bascik-server data-bascik-ts>const n: number = 1;</script>";
    expect(transpileInlineTypeScript(html)).toBe(html);
  });

  it("still strips when 'data-bascik-build' only appears inside an attribute value", () => {
    const html =
      '<script data-note="see data-bascik-build docs" data-bascik-ts>const n: number = 1;</script>';
    const result = transpileInlineTypeScript(html);
    expect(result).not.toContain("data-bascik-ts");
    expect(result).not.toContain(": number");
    expect(result).toContain('data-note="see data-bascik-build docs"');
  });

  it("leaves plain JS scripts in the same document untouched", () => {
    const html =
      "<script>const a = 1;</script>" +
      "<script data-bascik-ts>const b: number = 2;</script>";
    const out = transpileInlineTypeScript(html);
    expect(out).toContain("<script>const a = 1;</script>");
    expect(out).not.toContain(": number");
  });

  it("handles multiple TS scripts in one document", () => {
    const html =
      "<script data-bascik-ts>const a: number = 1;</script>" +
      "<p>hi</p>" +
      "<script data-bascik-ts>const b: string = 'x';</script>";
    const out = transpileInlineTypeScript(html);
    expect(out).not.toContain(": number");
    expect(out).not.toContain(": string");
    expect(out).toContain("<p>hi</p>");
  });

  it("ignores script-looking text inside style and textarea raw-text elements", () => {
    const html =
      "<style><script data-bascik-ts>const fake: number = 1;</script></style>" +
      "<textarea><script data-bascik-ts>const fake: number = 2;</script></textarea>" +
      "<script data-bascik-ts>const real: number = 3;</script>";
    const out = transpileInlineTypeScript(html);
    expect(out).toContain("<style><script data-bascik-ts>const fake: number = 1;</script></style>");
    expect(out).toContain("<textarea><script data-bascik-ts>const fake: number = 2;</script></textarea>");
    expect(out).toContain("<script>const real");
    expect(out).toContain("= 3;</script>");
    expect(out).not.toContain("const real: number");
  });

  it("warns and removes the block on unsupported TS syntax (enum)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => { });
    const html = "<div><script data-bascik-ts>enum E { A, B }</script></div>";
    const out = transpileInlineTypeScript(html, "src/components/my-card.html");
    expect(out).toBe("<div></div>");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("TypeScript strip error"),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("my-card.html"),
    );
  });

  it("preserves getElementById string literals for the scoping pipeline", () => {
    const html =
      '<script data-bascik-ts>const btn = document.getElementById("toggle") as HTMLButtonElement;\nbtn.addEventListener("click", (): void => {});</script>';
    const out = transpileInlineTypeScript(html);
    expect(out).toContain('document.getElementById("toggle")');
    expect(out).toContain('addEventListener("click"');
    expect(out).not.toContain("HTMLButtonElement");
  });
});
