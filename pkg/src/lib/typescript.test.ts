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
  it("detects lang=\"ts\"", () => {
    expect(isTypeScriptOpenTag('<script lang="ts">')).toBe(true);
  });

  it("detects lang='typescript' and bare/casing variants", () => {
    expect(isTypeScriptOpenTag("<script lang='typescript'>")).toBe(true);
    expect(isTypeScriptOpenTag("<script lang=ts>")).toBe(true);
    expect(isTypeScriptOpenTag('<script LANG="TS">')).toBe(true);
  });

  it("does not match other lang values or missing lang", () => {
    expect(isTypeScriptOpenTag('<script lang="js">')).toBe(false);
    expect(isTypeScriptOpenTag("<script>")).toBe(false);
    expect(isTypeScriptOpenTag('<script type="module">')).toBe(false);
  });

  it("does not match lang=ts inside another attribute value", () => {
    expect(isTypeScriptOpenTag('<script data-x="use lang=&quot;">')).toBe(false);
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
  it("returns html unchanged when no lang=\"ts\" script exists", () => {
    const html = "<div><script>const a = 1;</script></div>";
    expect(transpileInlineTypeScript(html)).toBe(html);
  });

  it("strips types from a lang=\"ts\" client script and removes the attribute", () => {
    const html = '<script lang="ts">const n: number = 1;\nconsole.log(n);</script>';
    const out = transpileInlineTypeScript(html);
    expect(out).not.toContain('lang="ts"');
    expect(out).not.toContain(": number");
    expect(out).toContain("<script>");
    expect(out).toContain("console.log(n);");
  });

  it("keeps other attributes on the open tag", () => {
    const html = '<script defer lang="ts" data-x="1">const a: string = "y";</script>';
    const out = transpileInlineTypeScript(html);
    expect(out).toContain('<script defer data-x="1">');
    expect(out).not.toContain(": string");
  });

  it("leaves data-bascik-build lang=\"ts\" scripts untouched (Node runs them)", () => {
    const html = '<script data-bascik-build lang="ts">const n: number = 1;</script>';
    expect(transpileInlineTypeScript(html)).toBe(html);
  });

  it("leaves data-bascik-server lang=\"ts\" scripts untouched (Node runs them)", () => {
    const html = '<script data-bascik-server lang="ts">const n: number = 1;</script>';
    expect(transpileInlineTypeScript(html)).toBe(html);
  });

  it("leaves plain JS scripts in the same document untouched", () => {
    const html =
      "<script>const a = 1;</script>" +
      '<script lang="ts">const b: number = 2;</script>';
    const out = transpileInlineTypeScript(html);
    expect(out).toContain("<script>const a = 1;</script>");
    expect(out).not.toContain(": number");
  });

  it("handles multiple TS scripts in one document", () => {
    const html =
      '<script lang="ts">const a: number = 1;</script>' +
      "<p>hi</p>" +
      "<script lang='typescript'>const b: string = 'x';</script>";
    const out = transpileInlineTypeScript(html);
    expect(out).not.toContain(": number");
    expect(out).not.toContain(": string");
    expect(out).toContain("<p>hi</p>");
  });

  it("warns and removes the block on unsupported TS syntax (enum)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => { });
    const html = '<div><script lang="ts">enum E { A, B }</script></div>';
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
      '<script lang="ts">const btn = document.getElementById("toggle") as HTMLButtonElement;\nbtn.addEventListener("click", (): void => {});</script>';
    const out = transpileInlineTypeScript(html);
    expect(out).toContain('document.getElementById("toggle")');
    expect(out).toContain('addEventListener("click"');
    expect(out).not.toContain("HTMLButtonElement");
  });
});
