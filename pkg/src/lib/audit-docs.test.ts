import { describe, it, expect, vi } from "vitest";
vi.mock("./config.js", () => ({
  BascikConfig: {
    obfuscateAttributeNames: false,
    scopeAttribute: { class: true, id: true, name: true },
    deduplicateCss: true,
    scopeScriptBlocks: true,
    inheritAttributes: true,
    minifyStyles: false,
    inlineStyles: false,
    isBuild: false,
    directory: { pages: "src/pages", components: "src/components", watch: [] },
  },
}));
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => "CSS"),
  writeFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
}));
vi.mock("./build-scripts.js", () => ({
  executeBuildScripts: vi.fn((html: string) => Promise.resolve(html)),
}));
vi.mock("./mem.js", () => ({ mem: { storePage: vi.fn(), pagesThisComponentIsUsedOn: vi.fn(() => []) } }));
vi.mock("./events.js", () => ({ eventEmitter: { emit: vi.fn() } }));

import { recursivelyTranspile } from "./processing.js";
import { convertCssElementSelectorsToClasses, prefixKeyframes, scopeInlineStyleTags } from "./styles.js";
import { prefixElementAttribute, namespaceScriptTags } from "./javascript.js";

const makeComponent = (fileContent: string, cssFileContent?: string) => ({
  name: "my-comp",
  fileContent,
  cssFileContent,
});

describe("docs-vs-code verification", () => {
  it("DOC1: scoped-css.md 'Class Scoping' example — `.navigation ul li a` descendant chain", () => {
    // doc says: .bascik__site-nav__a1b2c3__navigation ul li a { padding: 8px; }
    // i.e. element selectors inside descendant chain are NOT converted (only class scoped)
    const c = makeComponent('<div class="navigation"><ul><li><a>x</a></li></ul></div>',
      ".navigation ul li a { padding: 8px; }");
    const r = prefixElementAttribute(c, "class", "test1234");
    console.log("DOC1 css:", JSON.stringify(r.cssFileContent));
  });

  it("DOC2: scoped-css.md @keyframes documented example (spin)", () => {
    const c = makeComponent('<div class="icon"></div>',
      "@keyframes spin { to { transform: rotate(360deg); } }\n.icon { animation: spin 1s linear infinite; }");
    const r = prefixElementAttribute(c, "class", "test1234");
    console.log("DOC2 css:", JSON.stringify(r.cssFileContent));
  });

  it("DOC3: scoped-css.md 'dashed keyframe name' (common real-world)", () => {
    const c = makeComponent('<div class="icon"></div>',
      "@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }\n.icon { animation: fade-in 0.3s; }");
    const r = prefixElementAttribute(c, "class", "test1234");
    console.log("DOC3 css:", JSON.stringify(r.cssFileContent));
  });

  it("DOC4: props.md example end-to-end via recursivelyTranspile", () => {
    const componentList: any = {
      "alert-box": {
        fileName: "src/components/alert-box.html",
        fileContent: '<div class="alert"><strong data-bascik-prop-title></strong><p data-bascik-prop-message></p></div>',
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      '<alert-box data-bascik-prop-title="Success" data-bascik-prop-message="Your changes have been saved."></alert-box>',
      componentList,
    );
    console.log("DOC4:", JSON.stringify(transpiledHtmlBody));
  });

  it("DOC5: slots.md whitespace trimming claim — multiline usage", () => {
    const componentList: any = {
      "my-card": { fileName: "c/my-card.html", fileContent: '<div class="card"><div data-bascik-slot></div></div>' },
    };
    const a = recursivelyTranspile("<my-card><p>Hello</p></my-card>", componentList).transpiledHtmlBody;
    const b = recursivelyTranspile("<my-card>\n  <p>Hello</p>\n</my-card>", componentList).transpiledHtmlBody;
    console.log("DOC5 a:", JSON.stringify(a), "b:", JSON.stringify(b), "equal:", a === b);
  });

  it("DOC6: scoped-js.md — script type=module NOT wrapped but selectors rewritten", () => {
    const c = makeComponent('<div id="btn"></div><script type="module">document.getElementById("btn")</script>');
    const scoped = prefixElementAttribute(c, "id", "test1234");
    const wrapped = namespaceScriptTags(scoped);
    console.log("DOC6:", JSON.stringify(wrapped.fileContent));
  });

  it("DOC7: scoped-js.md — <script type=application/json> untouched (no IIFE, no scoping)", () => {
    const c = makeComponent('<script type="application/json" id="config-data">{ "theme": "dark" }</script>');
    const scoped = prefixElementAttribute(c, "id", "test1234");
    const wrapped = namespaceScriptTags(scoped);
    console.log("DOC7:", JSON.stringify(wrapped.fileContent));
  });

  it("DOC8: element selector in @media (docs @media example with class)", () => {
    const out = convertCssElementSelectorsToClasses("@media (max-width: 600px) {\n  .logo { font-size: 0.9rem; }\n}", "c");
    console.log("DOC8:", JSON.stringify(out));
  });

  it("DOC9: custom property used but NOT declared in file is left untouched (docs)", () => {
    const c = makeComponent('<div class="a"></div>', ".a { color: var(--global-var); }");
    const r = prefixElementAttribute(c, "class", "test1234");
    console.log("DOC9:", JSON.stringify(r.cssFileContent));
  });

  it("DOC10: slots.md named-slot 'everything left over goes into default slot'", () => {
    const componentList: any = {
      "page-layout": {
        fileName: "c/page-layout.html",
        fileContent: '<div class="layout"><header><div data-bascik-slot="header"></div></header><main><div data-bascik-slot></div></main><aside><div data-bascik-slot="sidebar"></div></aside></div>',
      },
    };
    const usage = '<page-layout>\n  <p>Main body content.</p>\n\n  <div data-bascik-slot="header">\n    <h1>Page Title</h1>\n  </div>\n\n  <div data-bascik-slot="sidebar">\n    <nav>Sidebar nav</nav>\n  </div>\n</page-layout>';
    const { transpiledHtmlBody } = recursivelyTranspile(usage, componentList);
    console.log("DOC10:", JSON.stringify(transpiledHtmlBody));
  });

  it("DOC11: compatibility.md — 'Multiple animation values: animation: a 1s, b 2s'", () => {
    const c = makeComponent('<div class="x"></div>',
      "@keyframes pulse { } @keyframes slide { } .x { animation: pulse 1s, slide 2s; }");
    const r = prefixElementAttribute(c, "class", "test1234");
    console.log("DOC11:", JSON.stringify(r.cssFileContent));
  });

  it("DOC12: compatibility.md — @supports scoping", () => {
    const c = makeComponent('<div class="foo"></div>', "@supports (display: grid) { .foo { display: grid; } }");
    const r = prefixElementAttribute(c, "class", "test1234");
    console.log("DOC12:", JSON.stringify(r.cssFileContent));
  });
});
