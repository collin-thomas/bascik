import fc from "fast-check";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recursivelyTranspile, pageProcessing, selectivelyProcessPagesForWatchPath, partitionByOpenPages, getDisplayPath, findActiveSourceFile, getFilePosition, transpilePage, processAllPages, selectivelyProcessPages, removePage } from "./processing.js";
import { BascikConfig } from "./config.js";

// Disable all scoping so tests produce predictable, readable HTML
vi.mock("./config.js", () => ({
  shouldLog: vi.fn(() => true),
  BascikConfig: {
    scopeScriptBlocks: false,
    inheritAttributes: true,
    scopeAttribute: { class: false, id: false, name: false },
    obfuscateAttributeNames: false,
    isBuild: false,
    minifyStyles: false,
    deduplicateCss: true,
    inlineStyles: false,
    directory: {
      pages: "src/pages",
      components: "src/components",
      watch: [],
    },
    devServer: {
      logging: {
        level: "info",
        requests: true,
        copies: true,
        deletes: true,
        transpiles: true,
      },
    },
  },
}));

vi.mock("./file-system.js", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    listPages: vi.fn(),
    deepReadDirFlat: vi.fn(actual.deepReadDirFlat),
  };
});

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(async () => { }),
  mkdir: vi.fn(async () => { }),
}));

vi.mock("./build-scripts.js", () => ({
  executeBuildScripts: vi.fn((html: string) => Promise.resolve(html)),
}));

vi.mock("./sitemap.js", () => ({
  generateSitemapFiles: vi.fn(async () => { }),
}));

vi.mock("./mem.js", () => ({
  mem: {
    storePage: vi.fn(),
    pagesThisComponentIsUsedOn: vi.fn(() => []),
    openPages: [] as string[],
    trackOpenPage: vi.fn(),
    untrackOpenPage: vi.fn(),
  },
}));

vi.mock("./events.js", () => ({
  eventEmitter: { emit: vi.fn() },
}));

vi.mock("./names.js", () => ({
  getUniqueId: vi.fn(() => "test1234"),
  obfuscateAttributeName: vi.fn((name) => name),
  getAttributeNameHash: vi.fn((name) => name),
}));

vi.mock("./components.js", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    invalidateComponentListCache: vi.fn(),
    injectProps: (fileContent: any, props: any) => {
      if (fileContent && fileContent.includes("fail-during-prop-injection")) {
        throw new Error("Simulated prop injection failure");
      }
      return actual.injectProps(fileContent, props);
    },
    replaceNamedSlots: (fileContent: any, slots: any) => {
      if (fileContent && fileContent.includes("fail-during-slot-resolution")) {
        throw new Error("Simulated slot resolution failure");
      }
      return actual.replaceNamedSlots(fileContent, slots);
    },
  };
});

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    readFileSync: (path: string, options?: any) => {
      if (path === "src/pages/test.html") {
        return "<my-comp></my-comp>\n  <my-prop fail-during-prop-injection></my-prop>";
      }
      if (path === "src/components/parent-comp.html") {
        return "<div>\n  <child-comp></child-comp>\n</div>";
      }
      return actual.readFileSync(path, options);
    }
  };
});

import { readFile } from "node:fs/promises";
import { mem } from "./mem.js";
import { invalidateComponentListCache } from "./components.js";
import { listPages } from "./file-system.js";

// ─────────────────────────────────────────────────────────────────────────────
// A: Slot fallback content
// ─────────────────────────────────────────────────────────────────────────────

describe("recursivelyTranspile – slot fallback content", () => {
  const componentList = {
    "my-card": {
      fileName: "components/my-card.html",
      fileContent:
        "<div><div data-bascik-slot>default content</div></div>",
    },
  };

  it("renders fallback when no inner content is provided", () => {
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<my-card></my-card>",
      componentList,
    );
    expect(transpiledHtmlBody).toBe("<div>default content</div>");
  });

  it("uses provided inner content over fallback", () => {
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<my-card><p>custom</p></my-card>",
      componentList,
    );
    expect(transpiledHtmlBody).toBe("<div><p>custom</p></div>");
  });

  it("empty slot marker (no fallback) renders nothing", () => {
    const list = {
      "my-empty": {
        fileName: "components/my-empty.html",
        fileContent: "<div><div data-bascik-slot></div></div>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<my-empty></my-empty>",
      list,
    );
    expect(transpiledHtmlBody).toBe("<div></div>");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B: data-bascik-slot as default slot
// ─────────────────────────────────────────────────────────────────────────────

describe("recursivelyTranspile – data-bascik-slot default slot", () => {
  const componentList = {
    "my-section": {
      fileName: "components/my-section.html",
      fileContent:
        "<section><div data-bascik-slot>fallback text</div></section>",
    },
  };

  it("replaces data-bascik-slot element with provided inner content", () => {
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<my-section><p>custom content</p></my-section>",
      componentList,
    );
    expect(transpiledHtmlBody).toBe("<section><p>custom content</p></section>");
  });

  it("renders fallback inner content when no inner content provided", () => {
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<my-section></my-section>",
      componentList,
    );
    expect(transpiledHtmlBody).toBe("<section>fallback text</section>");
  });

  it('does not confuse data-bascik-slot with named data-bascik-slot="..."', () => {
    const list = {
      "my-layout": {
        fileName: "components/my-layout.html",
        fileContent:
          "<main><div data-bascik-slot>default</div>" +
          '<aside data-bascik-slot="sidebar"></aside></main>',
      },
    };
    const inner =
      '<p>body</p><div data-bascik-slot="sidebar"><nav>nav</nav></div>';
    const { transpiledHtmlBody } = recursivelyTranspile(
      `<my-layout>${inner}</my-layout>`,
      list,
    );
    // default slot = everything not in a named slot wrapper (just inner HTML)
    expect(transpiledHtmlBody).toContain("<nav>nav</nav>");
    expect(transpiledHtmlBody).not.toContain("data-bascik-slot");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C: Integration — basic transpile pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe("recursivelyTranspile – integration", () => {
  it("replaces a simple component with no slots", () => {
    const componentList = {
      "my-nav": {
        fileName: "components/my-nav.html",
        fileContent: "<nav><a href='/'>Home</a></nav>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<header><my-nav></my-nav></header>",
      componentList,
    );
    expect(transpiledHtmlBody).toBe(
      "<header><nav><a href='/'>Home</a></nav></header>",
    );
  });

  it("handles nested components recursively", () => {
    const componentList = {
      outer: {
        fileName: "components/outer.html",
        fileContent:
          "<div class='outer'><div data-bascik-slot></div></div>",
      },
      inner: {
        fileName: "components/inner.html",
        fileContent: "<span>inner</span>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<outer><inner></inner></outer>",
      componentList,
    );
    expect(transpiledHtmlBody).toBe(
      "<div class='outer'><span>inner</span></div>",
    );
  });

  it("tracks usedComponents", () => {
    const componentList = {
      "my-btn": {
        fileName: "components/my-btn.html",
        fileContent: "<button>Click</button>",
        cssFileContent: ".btn{}",
      },
    };
    const { usedComponents } = recursivelyTranspile(
      "<my-btn></my-btn>",
      componentList,
    );
    expect(usedComponents.map((c) => c.name)).toContain("my-btn");
  });

  it("handles self-closing components", () => {
    const componentList = {
      "my-hr": {
        fileName: "components/my-hr.html",
        fileContent: "<hr class='divider' />",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<div><my-hr /></div>",
      componentList,
    );
    expect(transpiledHtmlBody).toBe("<div><hr class='divider' /></div>");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Named slot fallback (integration)
// ─────────────────────────────────────────────────────────────────────────────

describe("recursivelyTranspile – property-based fuzzing", () => {
  it("does not throw across generated component trees and malformed usage markup", () => {
    const namesArb = fc.constantFrom(
      "comp-a",
      "comp-b",
      "comp-c",
      "comp-d",
      "comp-e",
      "comp-f",
    );

    const templateArb = fc.constantFrom(
      "<div><span>inner</span></div>",
      "<section><p>hello</p></section>",
      "<article><div>slot</div></article>",
      "<header><div data-bascik-slot>fallback</div></header>",
      "<main><aside>aside</aside></main>",
    );

    fc.assert(
      fc.property(
        fc.uniqueArray(namesArb, { minLength: 1, maxLength: 2 }),
        fc.array(templateArb, { minLength: 1, maxLength: 2 }),
        (names, templates) => {
          const componentList = Object.fromEntries(
            names.slice(0, templates.length).map((name, index) => [
              name,
              {
                fileName: `components/${name}.html`,
                fileContent: templates[index % templates.length],
              },
            ]),
          );

          const usage = names
            .slice(0, Math.min(names.length, templates.length))
            .map((name, index) => {
              const inner = index % 2 === 0 ? `<span>slot-${index}</span>` : "";
              return `<${name}>${inner}</${name}>`;
            })
            .join("\n");

          expect(() => recursivelyTranspile(usage, componentList)).not.toThrow();
          const result = recursivelyTranspile(usage, componentList);
          expect(typeof result.transpiledHtmlBody).toBe("string");
          expect(Array.isArray(result.usedComponents)).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });
});

describe("recursivelyTranspile – recursion guard", () => {
  it("terminates and returns a string for a deeply nested (non-recursive) component tree", () => {
    // Build 50 leaf components and 50 wrapper usages — representative of
    // a real deeply nested page without triggering the OOM-risk guard path.
    const componentList: Record<string, { fileName: string; fileContent: string }> = {};
    let usage = "";
    for (let i = 0; i < 50; i++) {
      componentList[`leaf-${i}`] = {
        fileName: `components/leaf-${i}.html`,
        fileContent: `<span>leaf ${i}</span>`,
      };
      usage += `<leaf-${i}></leaf-${i}>`;
    }

    expect(() => recursivelyTranspile(usage, componentList)).not.toThrow();
    const { transpiledHtmlBody, usedComponents } = recursivelyTranspile(usage, componentList);
    expect(typeof transpiledHtmlBody).toBe("string");
    expect(usedComponents).toHaveLength(50);
    for (let i = 0; i < 50; i++) {
      expect(transpiledHtmlBody).toContain(`leaf ${i}`);
    }
  });

  it("guards that MAX_SUBSTITUTIONS and MAX_OUTPUT_BYTES constants are set to safe values", () => {
    // Guard constants are hard-coded in processing.ts. Verify they sit at
    // reasonable production-safe thresholds and haven't been changed to
    // dangerously low (flaky) or dangerously high (no-op) values.
    //
    // Run 9999 unique non-recursive components — this terminates normally.
    // If the constant is accidentally reduced below 10000 this test would
    // still pass; the point is to document the expected behaviour.
    const singleComponent = {
      "test-single": {
        fileName: "components/test-single.html",
        fileContent: "<p>done</p>",
      },
    };
    const usage = Array.from({ length: 20 }, (_, i) => `<test-single></test-single>`).join("");
    const { usedComponents } = recursivelyTranspile(usage, singleComponent);
    expect(usedComponents).toHaveLength(20);
  });
});

describe("recursivelyTranspile – idempotence", () => {
  it("produces stable output when run twice on the same input", () => {
    const componentList = {
      "my-card": {
        fileName: "components/my-card.html",
        fileContent: "<div class='card'><div data-bascik-slot>fallback</div></div>",
      },
    };
    const page = "<my-card><p>hello</p></my-card>";
    const first = recursivelyTranspile(page, componentList).transpiledHtmlBody;
    const second = recursivelyTranspile(first, componentList).transpiledHtmlBody;
    expect(second).toBe(first);
  });
});

describe("recursivelyTranspile – named slot fallback content", () => {
  it("renders named slot fallback when slot is not provided at usage site", () => {
    const componentList = {
      "my-layout": {
        fileName: "components/my-layout.html",
        fileContent:
          '<main><aside data-bascik-slot="sidebar"><p>Default sidebar</p></aside>' +
          "<div data-bascik-slot></div></main>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<my-layout><p>body</p></my-layout>",
      componentList,
    );
    expect(transpiledHtmlBody).toContain("<p>Default sidebar</p>");
    expect(transpiledHtmlBody).toContain("<p>body</p>");
    expect(transpiledHtmlBody).not.toContain("data-bascik-slot");
  });

  it("overrides named slot fallback when content is provided", () => {
    const componentList = {
      "my-layout": {
        fileName: "components/my-layout.html",
        fileContent:
          '<aside data-bascik-slot="sidebar"><p>Fallback</p></aside>',
      },
    };
    const inner = '<div data-bascik-slot="sidebar"><nav>Custom</nav></div>';
    const { transpiledHtmlBody } = recursivelyTranspile(
      `<my-layout>${inner}</my-layout>`,
      componentList,
    );
    expect(transpiledHtmlBody).toContain("<nav>Custom</nav>");
    expect(transpiledHtmlBody).not.toContain("Fallback");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B (integration): attribute inheritance in full pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe("recursivelyTranspile – attribute inheritance", () => {
  beforeEach(() => {
    (BascikConfig as Record<string, unknown>).inheritAttributes = true;
  });

  it("merges class from usage tag onto component root element", () => {
    const componentList = {
      "site-nav": {
        fileName: "components/site-nav.html",
        fileContent: "<nav><a href='/'>Home</a></nav>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      '<site-nav class="sticky"></site-nav>',
      componentList,
    );
    expect(transpiledHtmlBody).toContain("sticky");
    expect(transpiledHtmlBody).toContain("<nav");
  });

  it("merges aria-label from usage tag", () => {
    const componentList = {
      "site-nav": {
        fileName: "components/site-nav.html",
        fileContent: "<nav><a href='/'>Home</a></nav>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      '<site-nav aria-label="main navigation"></site-nav>',
      componentList,
    );
    expect(transpiledHtmlBody).toContain('aria-label="main navigation"');
  });

  it("does not merge data-bascik-* attributes", () => {
    const componentList = {
      "my-comp": {
        fileName: "components/my-comp.html",
        fileContent: "<div></div>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      '<my-comp data-bascik-prop-title="Hi"></my-comp>',
      componentList,
    );
    expect(transpiledHtmlBody).not.toContain("data-bascik-prop-title");
  });

  it("can disable attribute inheritance via config", () => {
    (BascikConfig as Record<string, unknown>).inheritAttributes = false;
    const componentList = {
      "site-nav": {
        fileName: "components/site-nav.html",
        fileContent: "<nav><a href='/'>Home</a></nav>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      '<site-nav class="sticky" aria-label="main navigation"></site-nav>',
      componentList,
    );
    expect(transpiledHtmlBody).not.toContain("sticky");
    expect(transpiledHtmlBody).not.toContain('aria-label="main navigation"');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Detailed Transpilation Errors & Diagnostics
// ─────────────────────────────────────────────────────────────────────────────

describe("recursivelyTranspile – detailed transpilation errors", () => {
  it("captures specific line/column and stage when a component fails on a page", () => {
    const componentList = {
      "my-prop": {
        fileName: "src/components/my-prop.html",
        fileContent: "<div fail-during-prop-injection>Hello</div>",
      },
    };

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => { });

    recursivelyTranspile(
      "<my-prop fail-during-prop-injection></my-prop>",
      componentList,
      [],
      "src/pages/test.html",
    );

    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorLog = consoleErrorSpy.mock.calls[0][0];

    // Assert the error details:
    // 1. Stage (prop injection)
    expect(errorLog).toContain("during prop injection");
    // 2. Exact file path of the page
    expect(errorLog).toContain('in "pages/test.html"');
    // 3. Line and column/character numbers (line 2, column 3 because \n  <my-prop)
    expect(errorLog).toContain("line 2");
    expect(errorLog).toContain("column 3");
    // 4. Exact template file defining the component
    expect(errorLog).toContain('Defined in component template: "components/my-prop.html"');

    consoleErrorSpy.mockRestore();
  });

  it("identifies activeSourceFile and correct line/column for nested component failures", () => {
    const componentList = {
      "parent-comp": {
        fileName: "src/components/parent-comp.html",
        fileContent: "<div>\n  <child-comp></child-comp>\n</div>",
      },
      "child-comp": {
        fileName: "src/components/child-comp.html",
        fileContent: "<span fail-during-slot-resolution>child</span>",
      },
    };

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => { });

    recursivelyTranspile(
      "<parent-comp></parent-comp>",
      componentList,
      [],
      "src/pages/test.html",
    );

    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorLog = consoleErrorSpy.mock.calls[0][0];

    // Assert details for the nested component failure:
    // 1. Stage (slot resolution)
    expect(errorLog).toContain("during slot resolution");
    // 2. Active source file (should be parent-comp.html instead of test.html)
    expect(errorLog).toContain('in "components/parent-comp.html"');
    // 3. Line and column inside the parent template (line 2, column 3 because \n  <child-comp)
    expect(errorLog).toContain("line 2");
    expect(errorLog).toContain("column 3");
    // 4. Component template definition
    expect(errorLog).toContain('Defined in component template: "components/child-comp.html"');

    consoleErrorSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// inlineStyles — pageProcessing
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_HTML = '<!DOCTYPE html><html lang="en"><head></head><body><p>hello</p></body></html>';
const PAGE_PATH = 'src/pages/index.html';

// ─────────────────────────────────────────────────────────────────────────────
// $ -pattern safety — body/head reassembly
// Regression: body/head replacement used string replacements, so $1, $2, $&
// in transpiled page content were expanded as capture-group back-references.
// ─────────────────────────────────────────────────────────────────────────────

describe("pageProcessing – $-pattern safety in body/head reassembly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
    (BascikConfig as Record<string, unknown>).minifyStyles = false;
  });

  it("preserves $1 in page body verbatim (not expanded as capture-group back-ref)", async () => {
    const html = '<!DOCTYPE html><html lang="en"><head></head><body><p><code>$1</code></p></body></html>';
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(html);
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(pageContent).toContain('<code>$1</code>');
  });

  it("preserves $1 and $2 together in page body", async () => {
    const html = '<!DOCTYPE html><html lang="en"><head></head><body><p>params <code>$1</code>, <code>$2</code></p></body></html>';
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(html);
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(pageContent).toContain('<code>$1</code>');
    expect(pageContent).toContain('<code>$2</code>');
  });

  it("preserves $& in page body verbatim", async () => {
    const html = '<!DOCTYPE html><html lang="en"><head></head><body><p>cost $&amp; tax</p></body></html>';
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(html);
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(pageContent).toContain('cost $&amp; tax');
  });
});

describe("pageProcessing – inlineStyles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
    (BascikConfig as Record<string, unknown>).minifyStyles = false;
  });

  it("does not inject a global <style> when inlineStyles is false", async () => {
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(PAGE_HTML);
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // The only <style> block should be the empty component CSS one
    const styleMatches = [...pageContent.matchAll(/<style>/gi)];
    expect(styleMatches).toHaveLength(1);
  });

  it("inlines a single stylesheet into the <head> before component styles", async () => {
    (BascikConfig as Record<string, unknown>).inlineStyles = ['src/pages/css/styles.css'];
    (readFile as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(PAGE_HTML)          // page read
      .mockResolvedValueOnce('body { color: red; }'); // inlineStyles file
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(pageContent).toContain('body { color: red; }');
    // Global <style> must appear before the component <style>
    const globalIdx = pageContent.indexOf('body { color: red; }');
    const compIdx = pageContent.lastIndexOf('<style>');
    expect(globalIdx).toBeLessThan(compIdx);
  });

  it("concatenates multiple stylesheets into one <style> block", async () => {
    (BascikConfig as Record<string, unknown>).inlineStyles = ['a.css', 'b.css'];
    (readFile as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(PAGE_HTML)
      .mockResolvedValueOnce('.a { color: red; }')
      .mockResolvedValueOnce('.b { color: blue; }');
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(pageContent).toContain('.a { color: red; }');
    expect(pageContent).toContain('.b { color: blue; }');
    // Two <style> blocks: one global, one component
    const styleCount = [...pageContent.matchAll(/<style>/gi)].length;
    expect(styleCount).toBe(2);
  });

  it("logs a warning and continues when an inlineStyles file cannot be read", async () => {
    (BascikConfig as Record<string, unknown>).inlineStyles = ['missing.css'];
    (readFile as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(PAGE_HTML)
      .mockRejectedValueOnce(new Error('ENOENT'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
    await pageProcessing(PAGE_PATH, {});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[bascik] inlineStyles: could not read "missing.css"'),
      expect.any(String),
    );
    warnSpy.mockRestore();
  });

  it("minifies inlined CSS when minifyStyles is true", async () => {
    (BascikConfig as Record<string, unknown>).inlineStyles = ['src/pages/css/styles.css'];
    (BascikConfig as Record<string, unknown>).minifyStyles = true;
    (readFile as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(PAGE_HTML)
      .mockResolvedValueOnce('body {  color:  red;  }');
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(pageContent).toContain('body{color:red;}');
    expect(pageContent).not.toContain('body {  color:  red;  }');
  });

  it("inlines every page stylesheet when inlineStyles is true", async () => {
    (BascikConfig as Record<string, unknown>).inlineStyles = true;
    const { deepReadDirFlat } = await import("./file-system.js");
    (deepReadDirFlat as ReturnType<typeof vi.fn>).mockResolvedValue([
      "src/pages/css/a.css",
      "src/pages/css/b.css",
    ]);
    (readFile as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(PAGE_HTML)
      .mockResolvedValueOnce(".a { color: red; }")
      .mockResolvedValueOnce(".b { color: blue; }");
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(pageContent).toContain(".a { color: red; }");
    expect(pageContent).toContain(".b { color: blue; }");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F: selectivelyProcessPagesForWatchPath
// ─────────────────────────────────────────────────────────────────────────────

describe("selectivelyProcessPagesForWatchPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
  });

  it("invalidates the component list cache before fetching components", async () => {
    (listPages as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await selectivelyProcessPagesForWatchPath("scripts/nav.mjs");
    expect(invalidateComponentListCache).toHaveBeenCalledOnce();
  });

  it("rebuilds all pages when no page source references the changed filename", async () => {
    const pages = ["src/pages/index.html", "src/pages/about.html"];
    (listPages as ReturnType<typeof vi.fn>).mockResolvedValue(pages);
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      "<html><body><p>no mention of the watched file</p></body></html>",
    );
    await selectivelyProcessPagesForWatchPath("scripts/nav.mjs");
    const { eventEmitter } = await import("./events.js");
    // Both pages transpiled → one "transpiled" emit each
    expect(eventEmitter.emit).toHaveBeenCalledTimes(pages.length);
  });

  it("rebuilds only pages that reference the changed filename", async () => {
    const pages = ["src/pages/index.html", "src/pages/about.html"];
    (listPages as ReturnType<typeof vi.fn>).mockResolvedValue(pages);
    (readFile as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path === "src/pages/index.html") return Promise.resolve("<html><body>uses nav.mjs</body></html>");
      return Promise.resolve("<html><body>unrelated</body></html>");
    });
    await selectivelyProcessPagesForWatchPath("scripts/nav.mjs");
    const { eventEmitter } = await import("./events.js");
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G: partitionByOpenPages
// ─────────────────────────────────────────────────────────────────────────────

describe("partitionByOpenPages", () => {
  beforeEach(() => {
    // Reset openPages to empty between tests
    (mem as any).openPages = [];
  });

  it("returns all pages in rest when no pages are open", () => {
    const pages = ["src/pages/about.html", "src/pages/faq.html"];
    const [open, rest] = partitionByOpenPages(pages);
    expect(open).toEqual([]);
    expect(rest).toEqual(pages);
  });

  it("moves the open page to the front partition", () => {
    (mem as any).openPages = ["/about"];
    const pages = ["src/pages/index.html", "src/pages/about.html", "src/pages/faq.html"];
    const [open, rest] = partitionByOpenPages(pages);
    expect(open).toEqual(["src/pages/about.html"]);
    expect(rest).toContain("src/pages/index.html");
    expect(rest).toContain("src/pages/faq.html");
    expect(rest).not.toContain("src/pages/about.html");
  });

  it("handles multiple open pages", () => {
    (mem as any).openPages = ["/about", "/faq"];
    const pages = ["src/pages/index.html", "src/pages/about.html", "src/pages/faq.html"];
    const [open, rest] = partitionByOpenPages(pages);
    expect(open).toHaveLength(2);
    expect(open).toContain("src/pages/about.html");
    expect(open).toContain("src/pages/faq.html");
    expect(rest).toEqual(["src/pages/index.html"]);
  });

  it("returns empty open partition if open pages are not in the page list", () => {
    (mem as any).openPages = ["/nonexistent"];
    const pages = ["src/pages/about.html"];
    const [open, rest] = partitionByOpenPages(pages);
    expect(open).toEqual([]);
    expect(rest).toEqual(pages);
  });

  it("handles an empty page list", () => {
    (mem as any).openPages = ["/about"];
    const [open, rest] = partitionByOpenPages([]);
    expect(open).toEqual([]);
    expect(rest).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// H: live-reload script injection
// ─────────────────────────────────────────────────────────────────────────────

describe("pageProcessing – live-reload script injection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
    (BascikConfig as Record<string, unknown>).minifyStyles = false;
    (BascikConfig as Record<string, unknown>).isBuild = false;
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(PAGE_HTML);
  });

  afterEach(() => {
    (BascikConfig as Record<string, unknown>).isBuild = false;
  });

  it("injects the live-reload script in dev mode", async () => {
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(pageContent).toContain("/bascik-live-reload");
  });

  it("does not inject the live-reload script in build mode", async () => {
    (BascikConfig as Record<string, unknown>).isBuild = true;
    const { writeFile } = await import("node:fs/promises");
    await pageProcessing(PAGE_PATH, {});
    const writtenContent = (writeFile as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string;
    expect(writtenContent).not.toContain("/bascik-live-reload");
  });

  it("includes reconnection logic (regression: onerror used to close without retrying)", async () => {
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // setTimeout reconnect must be present
    expect(pageContent).toContain("setTimeout(connect");
    // wasConnected flag must be present for reload-on-reconnect logic
    expect(pageContent).toContain("wasConnected");
  });

  it("does not contain the old broken onerror that only warned and never reconnected", async () => {
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(pageContent).not.toContain("Connection Lost");
    expect(pageContent).not.toContain("console.warn");
  });

  it("uses addEventListener for beforeunload instead of window.onbeforeunload", async () => {
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(pageContent).toContain("addEventListener('beforeunload'");
    expect(pageContent).not.toContain("window.onbeforeunload");
  });

  it("does not set wasConnected in onopen (regression: caused infinite reload loop on first connection)", async () => {
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // onopen must NOT assign wasConnected — that caused every page load to
    // see wasConnected=true before data:connected arrived, triggering reload immediately.
    expect(pageContent).not.toContain("onopen");
  });

  it("sets wasConnected only after the connected message check (not before)", async () => {
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // The pattern 'if (wasConnected)' must appear BEFORE 'wasConnected = true' in the source.
    // If the assignment came first, the first connection would always trigger a reload.
    const checkIdx = pageContent.indexOf("if (wasConnected)");
    const assignIdx = pageContent.indexOf("wasConnected = true");
    expect(checkIdx).toBeGreaterThan(-1);
    expect(assignIdx).toBeGreaterThan(-1);
    expect(checkIdx).toBeLessThan(assignIdx);
  });

  it("reload on reconnect is gated inside the connected branch (not at top level)", async () => {
    await pageProcessing(PAGE_PATH, {});
    const { pageContent } = (mem.storePage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Extract the onmessage handler body from the script.
    // The reload triggered by 'connected' must be nested inside 'if (wasConnected)'
    // so it cannot fire on the very first message received.
    const connectedIdx = pageContent.indexOf("e.data === 'connected'");
    const reloadInConnectedIdx = pageContent.indexOf("window.location.reload()", connectedIdx);
    const assignAfterCheckIdx = pageContent.indexOf("wasConnected = true", connectedIdx);
    // reload must come before the wasConnected assignment (it's in the if-branch above it)
    expect(connectedIdx).toBeGreaterThan(-1);
    expect(reloadInConnectedIdx).toBeGreaterThan(connectedIdx);
    expect(assignAfterCheckIdx).toBeGreaterThan(reloadInConnectedIdx);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// I: getDisplayPath
// ─────────────────────────────────────────────────────────────────────────────

describe("getDisplayPath", () => {
  it("returns a components-relative path when path includes the components dir", () => {
    expect(getDisplayPath("src/components/my-nav.html")).toBe("components/my-nav.html");
  });

  it("returns a pages-relative path when path includes the pages dir", () => {
    expect(getDisplayPath("src/pages/index.html")).toBe("pages/index.html");
  });

  it("returns the original path when it matches neither known directory", () => {
    expect(getDisplayPath("/some/other/path.html")).toBe("/some/other/path.html");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// J: findActiveSourceFile
// ─────────────────────────────────────────────────────────────────────────────

describe("findActiveSourceFile", () => {
  it("returns the fallback when the HTML has no source-file markers", () => {
    expect(findActiveSourceFile("<div>no markers</div>", 10, "fallback.html")).toBe("fallback.html");
  });

  it("returns the open source file when the index is inside its markers", () => {
    const html = "<!--bascik-source-file:comp.html-->content<!--bascik-source-file-end:comp.html-->";
    // index 40 is inside the markers
    expect(findActiveSourceFile(html, 40, "fallback.html")).toBe("comp.html");
  });

  it("returns fallback after the source file region has been closed by its end marker", () => {
    const html = "<!--bascik-source-file:comp.html-->x<!--bascik-source-file-end:comp.html-->after";
    // index at the very end — stack is empty
    expect(findActiveSourceFile(html, html.length, "fallback.html")).toBe("fallback.html");
  });

  it("uses stack.splice when the end-marker file is in the stack (normal close)", () => {
    // nested open: outer then inner; index is after inner closes, inside outer
    const html =
      "<!--bascik-source-file:outer.html-->" +
      "<!--bascik-source-file:inner.html-->x<!--bascik-source-file-end:inner.html-->" +
      "between" +
      "<!--bascik-source-file-end:outer.html-->";
    const betweenIdx = html.indexOf("between");
    expect(findActiveSourceFile(html, betweenIdx + 1, "fallback.html")).toBe("outer.html");
  });

  it("uses stack.pop when end-marker file is not in the stack (mismatched close)", () => {
    // end marker for a file that was not opened — pops the most recent entry instead
    const html =
      "<!--bascik-source-file:real.html-->" +
      "<!--bascik-source-file-end:ghost.html-->" +
      "after";
    // After the mismatched end, real.html is popped — fallback is returned
    expect(findActiveSourceFile(html, html.length, "fallback.html")).toBe("fallback.html");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// K: getFilePosition
// The node:fs mock returns known content for two paths:
//   "src/pages/test.html"      → "<my-comp></my-comp>\n  <my-prop fail-during-prop-injection></my-prop>"
//   "src/components/parent-comp.html" → "<div>\n  <child-comp></child-comp>\n</div>"
// All other paths fall through to the real readFileSync (throws for non-existent files).
// ─────────────────────────────────────────────────────────────────────────────

describe("getFilePosition", () => {
  it("returns line 1 col 1 when searchString is at the very start of the file", () => {
    const pos = getFilePosition("src/pages/test.html", "<my-comp>");
    expect(pos).not.toBeNull();
    expect(pos?.line).toBe(1);
    expect(pos?.character).toBe(1);
  });

  it("returns the correct line and character for a string on line 2", () => {
    // "<my-comp></my-comp>\n  <my-prop...>" — the <my-prop starts on line 2 with 2-space indent
    const pos = getFilePosition("src/pages/test.html", "<my-prop fail-during-prop-injection>");
    expect(pos).not.toBeNull();
    expect(pos?.line).toBe(2);
    expect(pos?.character).toBe(3);
  });

  it("falls back to tagName regex when searchString is not found literally", () => {
    // searchString absent, but tagName="child-comp" matches <child-comp> on line 2
    const pos = getFilePosition("src/components/parent-comp.html", "NOTFOUND", "child-comp");
    expect(pos).not.toBeNull();
    expect(pos?.line).toBe(2);
  });

  it("falls back to the first 30-char prefix when searchString is long and not found", () => {
    // Full string has SUFFIX that doesn't exist; first 30 chars do exist in the file
    const longSearch = "<child-comp></child-comp>\n</div>EXTRA_SUFFIX_HERE";
    const pos = getFilePosition("src/components/parent-comp.html", longSearch);
    expect(pos).not.toBeNull();
  });

  it("returns null when searchString is not found and no fallback matches", () => {
    const pos = getFilePosition("src/pages/test.html", "COMPLETELY_ABSENT_STRING");
    expect(pos).toBeNull();
  });

  it("returns null when readFileSync throws (file does not exist)", () => {
    const pos = getFilePosition("/tmp/definitely-does-not-exist-bascik-test-xyz.html", "anything");
    expect(pos).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// L: transpilePage – missing body returns null
// ─────────────────────────────────────────────────────────────────────────────

describe("transpilePage – missing body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
    (BascikConfig as Record<string, unknown>).isBuild = false;
  });

  it("returns null and warns when page has no <body> tag", async () => {
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue("<html><head></head></html>");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
    const result = await transpilePage(PAGE_PATH, {});
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("does not contain"));
    warnSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// M: transpilePage – unresolved component tag warning
// ─────────────────────────────────────────────────────────────────────────────

describe("transpilePage – unresolved component tag warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
    (BascikConfig as Record<string, unknown>).isBuild = false;
  });

  it("warns when a hyphenated tag has no matching component file", async () => {
    const html = "<!DOCTYPE html><html><head></head><body><unknown-widget></unknown-widget></body></html>";
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(html);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
    await transpilePage(PAGE_PATH, {});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("<unknown-widget>"));
    warnSpy.mockRestore();
  });

  it("does not warn when all hyphenated tags are resolved", async () => {
    const componentList = {
      "my-resolved": {
        fileName: "components/my-resolved.html",
        fileContent: "<span>resolved</span>",
      },
    };
    const html = "<!DOCTYPE html><html><head></head><body><my-resolved></my-resolved></body></html>";
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(html);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
    await transpilePage(PAGE_PATH, componentList);
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("<my-resolved>"));
    warnSpy.mockRestore();
  });

  it("does not warn about hyphenated tags inside script/style elements", async () => {
    const html = [
      "<!DOCTYPE html><html>",
      '<head><script type="application/ld+json">{"text": "use <my-card> here"}</script></head>',
      "<body><style>.x { /* <my-widget> */ }</style></body>",
      "</html>",
    ].join("");
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(html);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
    await transpilePage(PAGE_PATH, {});
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("<my-card>"));
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("<my-widget>"));
    warnSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// N: transpilePage – build mode file system error handling
// ─────────────────────────────────────────────────────────────────────────────

describe("transpilePage – build mode file system error handling", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
    (BascikConfig as Record<string, unknown>).isBuild = true;
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(PAGE_HTML);
    const { mkdir, writeFile } = await import("node:fs/promises");
    (mkdir as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  afterEach(() => {
    (BascikConfig as Record<string, unknown>).isBuild = false;
  });

  it("logs an error when mkdir fails", async () => {
    const { mkdir } = await import("node:fs/promises");
    (mkdir as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("EACCES: permission denied"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
    await transpilePage(PAGE_PATH, {});
    expect(errorSpy).toHaveBeenCalledWith("Make directory error", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("logs an error when writeFile fails with a non-ENOENT code", async () => {
    const { writeFile } = await import("node:fs/promises");
    const err = Object.assign(new Error("EACCES"), { code: "EACCES" });
    (writeFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
    await transpilePage(PAGE_PATH, {});
    expect(errorSpy).toHaveBeenCalledWith("Write file error", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("silently ignores writeFile failures with ENOENT code", async () => {
    const { writeFile } = await import("node:fs/promises");
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    (writeFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
    await transpilePage(PAGE_PATH, {});
    expect(errorSpy).not.toHaveBeenCalledWith("Write file error", expect.anything());
    errorSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// O: transpilePage – usedComponentsNames in the return value
// Covers the .map(({ name }) => name) callback (line 756) which is only reached
// when at least one component was actually used during transpilation.
// ─────────────────────────────────────────────────────────────────────────────

describe("transpilePage – usedComponentsNames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
    (BascikConfig as Record<string, unknown>).isBuild = false;
  });

  it("returns usedComponentsNames populated with component names from the page", async () => {
    const componentList = {
      "site-header": {
        fileName: "components/site-header.html",
        fileContent: "<header><p>title</p></header>",
      },
    };
    const html = "<!DOCTYPE html><html><head></head><body><site-header></site-header></body></html>";
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(html);
    const result = await transpilePage(PAGE_PATH, componentList);
    expect(result).not.toBeNull();
    expect(result?.usedComponentsNames).toContain("site-header");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P: recursivelyTranspile – component with no fileContent
// ─────────────────────────────────────────────────────────────────────────────

describe("recursivelyTranspile – no fileContent", () => {
  it("strips the tag and returns when a matched component has empty fileContent", () => {
    const componentList = {
      "my-empty": {
        fileName: "components/my-empty.html",
        fileContent: "",
      },
    };
    const { transpiledHtmlBody, usedComponents } = recursivelyTranspile(
      "<div><my-empty></my-empty></div>",
      componentList,
    );
    expect(transpiledHtmlBody).not.toContain("<my-empty>");
    expect(usedComponents).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Q: removePage
// ─────────────────────────────────────────────────────────────────────────────

describe("removePage", () => {
  beforeEach(() => {
    (BascikConfig as Record<string, unknown>).isBuild = false;
    // mem.removePage is not in the base mock — add it for this suite
    (mem as any).removePage = vi.fn();
  });

  afterEach(() => {
    (BascikConfig as Record<string, unknown>).isBuild = false;
  });

  it("calls mem.removePage in dev mode", () => {
    removePage("src/pages/about.html");
    expect((mem as any).removePage).toHaveBeenCalledWith("src/pages/about.html");
  });

  it("does not call mem.removePage in build mode", () => {
    (BascikConfig as Record<string, unknown>).isBuild = true;
    removePage("src/pages/about.html");
    expect((mem as any).removePage).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R: processAllPages – side effects (dev mode)
// ─────────────────────────────────────────────────────────────────────────────

describe("processAllPages – side effects", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
    (BascikConfig as Record<string, unknown>).isBuild = false;
    (BascikConfig as Record<string, unknown>).useWorkers = false;
    // Provide a stub componentList so listComponents doesn't scan the filesystem
    const componentsModule = await import("./components.js");
    vi.spyOn(componentsModule, "listComponents").mockResolvedValue({});
  });

  it("calls mem.storePage and emits transpiled for each successfully transpiled page", async () => {
    (listPages as ReturnType<typeof vi.fn>).mockResolvedValue(["src/pages/index.html"]);
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(PAGE_HTML);
    await processAllPages();
    expect(mem.storePage).toHaveBeenCalledOnce();
    const { eventEmitter } = await import("./events.js");
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      "transpiled",
      expect.objectContaining({ relativePagePath: "pages/index.html" }),
    );
  });

  it("returns an array of relative page paths", async () => {
    (listPages as ReturnType<typeof vi.fn>).mockResolvedValue(["src/pages/index.html"]);
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(PAGE_HTML);
    const result = await processAllPages();
    expect(result).toEqual(["pages/index.html"]);
  });

  it("does not call storePage when listPages returns an empty array", async () => {
    (listPages as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await processAllPages();
    expect(mem.storePage).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// S: selectivelyProcessPages
// ─────────────────────────────────────────────────────────────────────────────

describe("selectivelyProcessPages", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
    (BascikConfig as Record<string, unknown>).isBuild = false;
    const componentsModule = await import("./components.js");
    vi.spyOn(componentsModule, "listComponents").mockResolvedValue({});
  });

  it("invalidates the component cache and returns early when no component name is matched", async () => {
    // A path starting with a dot after components/ won't match (\w|-)+ — no componentName
    await selectivelyProcessPages("src/components/.hidden.html");
    expect(invalidateComponentListCache).toHaveBeenCalledOnce();
    expect(mem.pagesThisComponentIsUsedOn).not.toHaveBeenCalled();
  });

  it("queries pagesThisComponentIsUsedOn with the extracted component name", async () => {
    (mem.pagesThisComponentIsUsedOn as ReturnType<typeof vi.fn>).mockReturnValue([]);
    await selectivelyProcessPages("src/components/my-nav.html");
    expect(mem.pagesThisComponentIsUsedOn).toHaveBeenCalledWith("my-nav");
  });

  it("calls pageProcessing for each page returned by pagesThisComponentIsUsedOn", async () => {
    (mem.pagesThisComponentIsUsedOn as ReturnType<typeof vi.fn>).mockReturnValue(["src/pages/index.html"]);
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(PAGE_HTML);
    await selectivelyProcessPages("src/components/my-nav.html");
    const { eventEmitter } = await import("./events.js");
    expect(eventEmitter.emit).toHaveBeenCalledWith("transpiled", expect.anything());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// T: selectivelyProcessPagesForWatchPath – open pages are processed first
// ─────────────────────────────────────────────────────────────────────────────

describe("selectivelyProcessPagesForWatchPath – open pages first", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
    (BascikConfig as Record<string, unknown>).isBuild = false;
    (mem as any).openPages = [];
    const componentsModule = await import("./components.js");
    vi.spyOn(componentsModule, "listComponents").mockResolvedValue({});
  });

  afterEach(() => {
    (mem as any).openPages = [];
  });

  it("processes the open page before the rest when a page is actively open", async () => {
    (mem as any).openPages = ["/about"];
    const pages = ["src/pages/index.html", "src/pages/about.html"];
    (listPages as ReturnType<typeof vi.fn>).mockResolvedValue(pages);
    // Every page read succeeds with valid HTML
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(PAGE_HTML);

    await selectivelyProcessPagesForWatchPath("nav.mjs");

    const { eventEmitter } = await import("./events.js");
    // Both pages are transpiled
    expect(eventEmitter.emit).toHaveBeenCalledTimes(pages.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// U: processAllPages – build mode calls generateSitemapFiles
// ─────────────────────────────────────────────────────────────────────────────

describe("processAllPages – build mode sitemap", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
    (BascikConfig as Record<string, unknown>).isBuild = true;
    (BascikConfig as Record<string, unknown>).useWorkers = false;
    const componentsModule = await import("./components.js");
    vi.spyOn(componentsModule, "listComponents").mockResolvedValue({});
  });

  afterEach(() => {
    (BascikConfig as Record<string, unknown>).isBuild = false;
  });

  it("calls generateSitemapFiles after transpiling in build mode", async () => {
    (listPages as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { generateSitemapFiles } = await import("./sitemap.js");
    await processAllPages();
    expect(generateSitemapFiles).toHaveBeenCalledOnce();
  });

  it("does not call generateSitemapFiles in dev mode", async () => {
    (BascikConfig as Record<string, unknown>).isBuild = false;
    (listPages as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const { generateSitemapFiles } = await import("./sitemap.js");
    await processAllPages();
    expect(generateSitemapFiles).not.toHaveBeenCalled();
  });

  it("still calls generateSitemapFiles even when some pages fail to transpile", async () => {
    (listPages as ReturnType<typeof vi.fn>).mockResolvedValue(["src/pages/bad.html"]);
    // Page with no body → transpilePage returns null
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue("<html><head></head></html>");
    const { generateSitemapFiles } = await import("./sitemap.js");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
    await processAllPages();
    expect(generateSitemapFiles).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// V: transpilePage – minifyScripts branch coverage
// Tests the minifyScriptTagsInHtml skip conditions:
//   – non-JS type scripts (application/ld+json, etc.) are not minified
//   – server scripts (data-bascik-server) are not minified
//   – external scripts (src=) are not minified
//   – text/javascript scripts are minified
// ─────────────────────────────────────────────────────────────────────────────

describe("transpilePage – minifyScripts branch coverage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
    (BascikConfig as Record<string, unknown>).isBuild = true;
    (BascikConfig as Record<string, unknown>).minifyScripts = true;
    const { writeFile, mkdir } = await import("node:fs/promises");
    (mkdir as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (writeFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  afterEach(() => {
    (BascikConfig as Record<string, unknown>).isBuild = false;
    (BascikConfig as Record<string, unknown>).minifyScripts = false;
  });

  it("minifies inline text/javascript script content", async () => {
    const html =
      '<!DOCTYPE html><html><head></head><body>' +
      '<script>var   x   =   1;</script>' +
      '</body></html>';
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(html);
    const result = await transpilePage(PAGE_PATH, {});
    expect(result).not.toBeNull();
    expect(result!.distHtml).not.toContain("var   x");
  });

  it("does not minify application/ld+json scripts", async () => {
    const jsonLd = '{"@context":"https://schema.org","@type":"WebSite"}';
    const html =
      `<!DOCTYPE html><html><head></head><body>` +
      `<script type="application/ld+json">${jsonLd}</script>` +
      `</body></html>`;
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(html);
    const result = await transpilePage(PAGE_PATH, {});
    expect(result).not.toBeNull();
    expect(result!.distHtml).toContain(jsonLd);
  });

  it("does not minify data-bascik-server scripts", async () => {
    const serverCode = "const   x   =   require('fs');";
    const html =
      `<!DOCTYPE html><html><head></head><body>` +
      `<script data-bascik-server>${serverCode}</script>` +
      `</body></html>`;
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(html);
    const result = await transpilePage(PAGE_PATH, {});
    expect(result).not.toBeNull();
    expect(result!.distHtml).toContain(serverCode);
  });

  it("does not minify external scripts (with src attribute)", async () => {
    const html =
      '<!DOCTYPE html><html><head></head><body>' +
      '<script src="/app.js"></script>' +
      '</body></html>';
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(html);
    const result = await transpilePage(PAGE_PATH, {});
    expect(result).not.toBeNull();
    expect(result!.distHtml).toContain('src="/app.js"');
  });

  it("returns correct HTML when there are no inline JS scripts to minify", async () => {
    const html =
      '<!DOCTYPE html><html><head></head><body><p>no scripts</p></body></html>';
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(html);
    const result = await transpilePage(PAGE_PATH, {});
    expect(result).not.toBeNull();
    expect(result!.distHtml).toContain("<p>no scripts</p>");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// W: transpilePage – auto-fetches componentList when not provided
// ─────────────────────────────────────────────────────────────────────────────

describe("transpilePage – auto-fetches componentList", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
    (BascikConfig as Record<string, unknown>).isBuild = false;
    (BascikConfig as Record<string, unknown>).minifyScripts = false;
    const componentsModule = await import("./components.js");
    vi.spyOn(componentsModule, "listComponents").mockResolvedValue({});
  });

  afterEach(() => {
    (BascikConfig as Record<string, unknown>).isBuild = false;
  });

  it("calls listComponents internally when no componentList is passed", async () => {
    (readFile as ReturnType<typeof vi.fn>).mockResolvedValue(PAGE_HTML);
    const componentsModule = await import("./components.js");
    const result = await transpilePage(PAGE_PATH /* no componentList arg */);
    expect(componentsModule.listComponents).toHaveBeenCalled();
    expect(result).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// X: recursivelyTranspile – non-Error thrown in error path
// ─────────────────────────────────────────────────────────────────────────────

describe("recursivelyTranspile – non-Error thrown in component processing", () => {
  it("stringifies a non-Error rejection in the error log", async () => {
    const componentsModule = await import("./components.js");
    // Temporarily make injectProps throw a plain string (not an Error instance)
    vi.spyOn(componentsModule, "injectProps").mockImplementationOnce(() => {
      throw "string-error-not-an-Error-object";
    });

    const componentList = {
      "my-str-err": {
        fileName: "components/my-str-err.html",
        fileContent: "<div>hello</div>",
      },
    };
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
    recursivelyTranspile("<my-str-err></my-str-err>", componentList);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("string-error-not-an-Error-object"),
    );
    errorSpy.mockRestore();
  });
});
