import { describe, it, expect, vi, beforeEach } from "vitest";
import { recursivelyTranspile, pageProcessing, selectivelyProcessPagesForWatchPath } from "./processing.js";
import { BascikConfig } from "./config.js";

// Disable all scoping so tests produce predictable, readable HTML
vi.mock("./config.js", () => ({
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

vi.mock("./mem.js", () => ({
  mem: {
    storePage: vi.fn(),
    pagesThisComponentIsUsedOn: vi.fn(() => []),
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
