import { describe, it, expect, vi } from "vitest";
vi.mock("./config.js", () => ({
  BascikConfig: {
    obfuscateAttributeNames: false,
    scopeAttribute: { class: true, id: true, name: true },
    deduplicateCss: true,
  },
}));
import { prefixElementAttribute } from "./javascript.js";

const makeComponent = (fileContent: string, cssFileContent?: string) => ({
  name: "my-comp",
  fileContent,
  cssFileContent,
});

describe("docs-vs-code batch 3 — dedup:false + el selectors", () => {
  it("D3-1: deduplicateCss FALSE — element selectors scoped per-instance? and class injection", () => {
    const c = makeComponent('<p>hi</p>', "p { color: red; }");
    const r = prefixElementAttribute(c, "class", "test1234", false);
    console.log("D3-1 css:", JSON.stringify(r.cssFileContent));
    console.log("D3-1 html:", JSON.stringify(r.fileContent));
  });

  it("D3-2: dedup FALSE — two instances produce DIFFERENT element classes but same-scope CSS collision?", () => {
    // instance A
    const a = prefixElementAttribute(makeComponent('<p>hi</p>', "p { color: red; }"), "class", "AAAA", false);
    const b = prefixElementAttribute(makeComponent('<p>hi</p>', "p { color: red; }"), "class", "BBBB", false);
    console.log("D3-2 A css:", JSON.stringify(a.cssFileContent), "html:", JSON.stringify(a.fileContent));
    console.log("D3-2 B css:", JSON.stringify(b.cssFileContent), "html:", JSON.stringify(b.fileContent));
  });
});
