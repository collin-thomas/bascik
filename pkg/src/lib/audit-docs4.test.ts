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

describe("docs-vs-code batch 4 — innerHTML claim", () => {
  it("D4-1: compatibility.md claims innerHTML class strings are rewritten", () => {
    const c = makeComponent(
      '<div class="box"></div><script>el.innerHTML = \'<div class="box">x</div>\'</script>',
    );
    const r = prefixElementAttribute(c, "class", "test1234");
    console.log("D4-1:", JSON.stringify(r.fileContent));
  });

  it("D4-2: getElementsByName rewritten (docs)", () => {
    const c = makeComponent('<input name="email"><script>document.getElementsByName("email")</script>');
    const r = prefixElementAttribute(c, "name", "test1234");
    console.log("D4-2:", JSON.stringify(r.fileContent));
  });
});
