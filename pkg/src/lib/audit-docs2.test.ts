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

describe("docs-vs-code batch 2", () => {
  it("D2-1: full pipeline on doc keyframes example — does 'to' break the keyframe block?", () => {
    const c = makeComponent('<div class="icon"></div>',
      "@keyframes spin { to { transform: rotate(360deg); } }\n.icon { animation: spin 1s linear infinite; }");
    const r = prefixElementAttribute(c, "class", "test1234");
    console.log("D2-1 css:", JSON.stringify(r.cssFileContent));
    // also: is 'to' added to elementsConvertedClasses and injected into HTML?
    console.log("D2-1 html:", JSON.stringify(r.fileContent));
  });

  it("D2-2: doc scoped-css descendant chain with elements — class injection onto nested elements", () => {
    const c = makeComponent('<ul><li><a href="#">x</a></li></ul>',
      ".navigation ul li a { padding: 8px; }");
    const r = prefixElementAttribute(c, "class", "test1234");
    console.log("D2-2 css:", JSON.stringify(r.cssFileContent));
    console.log("D2-2 html:", JSON.stringify(r.fileContent));
  });

  it("D2-3: inline <style> keyframes example (docs say inline style tags get full pipeline)", () => {
    const c = makeComponent('<style>@keyframes spin { to { transform: rotate(360deg); } } .icon { animation: spin 1s; }</style><div class="icon"></div>');
    const r = prefixElementAttribute(c, "class", "test1234");
    console.log("D2-3 html:", JSON.stringify(r.fileContent));
  });

  it("D2-4: scoped-css.md compiled-output claim for element selectors uses __x1__ (per-instance) — but dedup default scopes to name only", () => {
    // doc shows: .bascik__my-comp__x1__el__p — with instance id x1.
    // code (dedup true) uses scopeKey = component.name → .bascik__my-comp__el__p (no instance)
    const c = makeComponent('<p>hi</p>', "p { color: red; }");
    const r = prefixElementAttribute(c, "class", "test1234");
    console.log("D2-4 css:", JSON.stringify(r.cssFileContent));
  });

  it("D2-5: scoped-css.md class scoping claim — 'Every class name prefixed with a unique instance ID'", () => {
    // Doc text: "Every class name in the .css file is prefixed with a unique instance ID."
    // Code (dedup default): class scoped to component NAME only (no instanceId).
    const c = makeComponent('<div class="navigation"></div>', ".navigation { color: red; }");
    const r = prefixElementAttribute(c, "class", "test1234");
    console.log("D2-5 css:", JSON.stringify(r.cssFileContent), "html:", JSON.stringify(r.fileContent));
  });
});
